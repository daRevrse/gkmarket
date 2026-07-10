"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  deliveries,
  orderItems,
  orders,
  products,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { notify } from "@/lib/notify";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

// Transitions vendeur : une commande payée se prépare, puis s'expédie.
// La livraison est confirmée par l'acheteur (déblocage Escrow).
const transitions: Record<string, "paid" | "processing"> = {
  processing: "paid",
  shipped: "processing",
};

export async function advanceOrder(
  orderId: string,
  to: "processing" | "shipped",
  info?: { trackingNumber?: string; estimatedDeliveryAt?: string | null },
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (user?.sellerProfile?.status !== "approved") {
    return { error: "Réservé aux vendeurs approuvés." };
  }

  // L'expédition manuelle est réservée à l'auto-livraison : si une course
  // est en cours, c'est le livreur qui fait avancer la commande.
  if (to === "shipped") {
    const active = await getActiveDelivery(orderId);
    if (active) {
      return { error: "Une course de livraison est en cours sur cette commande." };
    }
  }

  const trackingNumber = info?.trackingNumber?.trim() || null;
  const parsedEta = info?.estimatedDeliveryAt
    ? new Date(info.estimatedDeliveryAt)
    : null;
  const estimatedDeliveryAt =
    parsedEta && !Number.isNaN(parsedEta.getTime()) ? parsedEta : null;

  const from = transitions[to];
  const updated = await db
    .update(orders)
    .set({
      status: to,
      shippedAt: to === "shipped" ? new Date() : undefined,
      ...(to === "shipped" ? { trackingNumber, estimatedDeliveryAt } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.sellerId, user.sellerProfile.id),
        eq(orders.status, from),
      ),
    )
    .returning({
      id: orders.id,
      number: orders.number,
      buyerId: orders.buyerId,
    });
  if (updated.length === 0) {
    return { error: "Transition impossible (statut déjà modifié ?)." };
  }

  // Confirmation d'acceptation par le vendeur (MVP n°132, 144).
  if (to === "processing") {
    await notify(updated[0].buyerId, {
      type: "order_confirmed",
      title: `Commande ${updated[0].number} acceptée`,
      body: "Le vendeur a accepté votre commande et la prépare.",
      link: `/compte/commandes/${updated[0].id}`,
      email: true,
    });
  }

  // L'acheteur suit l'avancement (MVP n°305).
  if (to === "shipped") {
    await notify(updated[0].buyerId, {
      type: "order_shipped",
      title: `Commande ${updated[0].number} expédiée`,
      body: `Le vendeur a expédié votre commande.${trackingNumber ? ` Suivi : ${trackingNumber}.` : ""} Confirmez la réception à l'arrivée pour libérer les fonds.`,
      link: `/compte/commandes/${updated[0].id}`,
      email: true,
    });
  }

  revalidatePath("/vendeur/commandes");
  revalidatePath("/compte/commandes");
  revalidatePath(`/compte/commandes/${orderId}`);
  return {};
}

/**
 * Refus d'une commande par le vendeur, avec motif (MVP n°145) : possible tant
 * que le colis n'a pas été récupéré. Rembourse l'acheteur (si payé), restitue
 * le stock et annule une éventuelle course non récupérée.
 */
export async function refuseOrder(
  orderId: string,
  reason: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (user?.sellerProfile?.status !== "approved") {
    return { error: "Réservé aux vendeurs approuvés." };
  }
  const motive = reason.trim();
  if (!motive) return { error: "Indiquez le motif du refus." };

  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.sellerId, user.sellerProfile.id)),
    )
    .limit(1);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "paid" && order.status !== "processing") {
    return {
      error: "Seule une commande payée non expédiée peut être refusée.",
    };
  }

  const [pickedUp] = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(and(eq(deliveries.orderId, orderId), eq(deliveries.status, "picked_up")))
    .limit(1);
  if (pickedUp) {
    return {
      error: "Le colis a déjà été récupéré par un livreur : refus impossible.",
    };
  }

  const wallet = order.paidAt ? await getOrCreateWallet(order.buyerId) : null;

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new Error("conflict");

    if (order.paidAt && wallet) {
      await applyWalletMovement(tx, wallet.id, {
        type: "order_refund",
        amountFcfa: order.totalFcfa,
        orderId: order.id,
        description: `Remboursement commande ${order.number} refusée par le vendeur`,
      });
    }

    await tx
      .update(deliveries)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(deliveries.orderId, order.id),
          inArray(deliveries.status, ["proposed", "accepted"]),
        ),
      );

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (item.productId) {
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }
    }
  });

  await notify(order.buyerId, {
    type: "order_cancelled",
    title: `Commande ${order.number} refusée par le vendeur`,
    body: `Motif : ${motive}.${order.paidAt ? ` Vous avez été intégralement remboursé (${formatFcfa(order.totalFcfa)}).` : ""}`,
    link: `/compte/commandes/${order.id}`,
    email: true,
  });

  revalidatePath("/vendeur/commandes");
  revalidatePath("/compte/commandes");
  revalidatePath(`/compte/commandes/${orderId}`);
  revalidatePath("/compte/wallet");
  revalidatePath("/livreur/courses");
  revalidatePath("/produits");
  return {};
}

async function getActiveDelivery(orderId: string) {
  const [active] = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.orderId, orderId),
        notInArray(deliveries.status, ["refused", "cancelled"]),
      ),
    )
    .limit(1);
  return active ?? null;
}

/**
 * Le vendeur propose la course à un livreur choisi parmi la liste proposée
 * (cf. docs/CHANGEMENTS.md §3). Le gain du livreur = les frais de livraison
 * de la commande, versés à son wallet au déblocage de l'Escrow.
 */
export async function proposeDelivery(
  orderId: string,
  courierId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (user?.sellerProfile?.status !== "approved") {
    return { error: "Réservé aux vendeurs approuvés." };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.sellerId, user.sellerProfile.id)),
    )
    .limit(1);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "paid" && order.status !== "processing") {
    return {
      error: "Un livreur ne peut être demandé que sur une commande payée.",
    };
  }

  const [courier] = await db
    .select()
    .from(courierProfiles)
    .where(eq(courierProfiles.id, courierId))
    .limit(1);
  if (!courier || courier.status !== "approved") {
    return { error: "Ce livreur n'est pas disponible." };
  }
  if (courier.userId === user.id) {
    return { error: "Vous ne pouvez pas vous proposer votre propre course." };
  }

  try {
    await db.insert(deliveries).values({
      orderId: order.id,
      sellerId: user.sellerProfile.id,
      courierId,
      feeFcfa: order.deliveryFeeFcfa,
    });
  } catch {
    // Index unique partiel : une seule course active par commande.
    return { error: "Une course est déjà en cours pour cette commande." };
  }

  await notify(courier.userId, {
    type: "delivery_proposed",
    title: `Nouvelle course proposée - ${order.number}`,
    body: `Gain : ${formatFcfa(order.deliveryFeeFcfa)}. Livraison à ${order.shippingCity}${order.shippingDistrict ? ` (${order.shippingDistrict})` : ""}. Acceptez ou refusez depuis vos courses.`,
    link: "/livreur/courses",
    email: true,
  });

  revalidatePath("/vendeur/commandes");
  revalidatePath("/livreur/courses");
  return {};
}

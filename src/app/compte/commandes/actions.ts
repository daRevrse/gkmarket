"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  deliveries,
  orderItems,
  orders,
  products,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { notify } from "@/lib/notify";
import { commissionFcfa } from "@/lib/pricing";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

async function sellerUserId(sellerProfileId: string): Promise<string | null> {
  const [seller] = await db
    .select({ userId: sellerProfiles.userId })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, sellerProfileId))
    .limit(1);
  return seller?.userId ?? null;
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/compte/commandes");
  revalidatePath(`/compte/commandes/${orderId}`);
  revalidatePath("/vendeur/commandes");
  revalidatePath("/livreur/courses");
  revalidatePath("/compte/wallet");
}

async function getOwnOrder(userId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.buyerId, userId)))
    .limit(1);
  return order ?? null;
}

/** Paiement wallet : fonds débités et bloqués en Escrow (MVP n°115-116). */
export async function payOrder(orderId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const order = await getOwnOrder(user.id, orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "pending_payment") {
    return { error: "Cette commande n'est pas en attente de paiement." };
  }

  const wallet = await getOrCreateWallet(user.id);
  if (wallet.balanceFcfa < order.totalFcfa) {
    return {
      error: `Solde insuffisant : ${formatFcfa(wallet.balanceFcfa)} disponibles, ${formatFcfa(order.totalFcfa)} requis. Rechargez votre wallet.`,
    };
  }

  let ok = false;
  await db.transaction(async (tx) => {
    ok = await applyWalletMovement(tx, wallet.id, {
      type: "order_payment",
      amountFcfa: -order.totalFcfa,
      orderId: order.id,
      description: `Paiement commande ${order.number} (fonds en Escrow)`,
    });
    if (!ok) return;
    await tx
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending_payment")));
  });
  if (!ok) return { error: "Solde insuffisant. Rechargez votre wallet." };

  // Le vendeur sait que les fonds sont sécurisés (MVP n°304).
  const sellerUid = await sellerUserId(order.sellerId);
  if (sellerUid) {
    await notify(sellerUid, {
      type: "order_paid",
      title: `Paiement reçu en Escrow — ${order.number}`,
      body: `${formatFcfa(order.totalFcfa)} sécurisés. Préparez la commande.`,
      link: "/vendeur/commandes",
      email: true,
    });
  }

  revalidateOrderPaths(orderId);
  return {};
}

/**
 * Annulation possible tant que la commande n'est pas expédiée
 * (MVP n°126) : remboursement wallet si déjà payée, et re-stock.
 */
export async function cancelOrder(orderId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const order = await getOwnOrder(user.id, orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "pending_payment" && order.status !== "paid") {
    return { error: "Cette commande ne peut plus être annulée (déjà en traitement)." };
  }

  const wallet = await getOrCreateWallet(user.id);

  await db.transaction(async (tx) => {
    // Verrou optimiste : seul le statut courant est annulable.
    const updated = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new Error("conflict");

    if (order.status === "paid") {
      await applyWalletMovement(tx, wallet.id, {
        type: "order_refund",
        amountFcfa: order.totalFcfa,
        orderId: order.id,
        description: `Remboursement commande ${order.number} annulée`,
      });
    }

    // Une course encore non récupérée est annulée avec la commande.
    await tx
      .update(deliveries)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(deliveries.orderId, order.id),
          inArray(deliveries.status, ["proposed", "accepted"]),
        ),
      );

    // Re-stock des articles dont le produit existe encore
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

  const sellerUid = await sellerUserId(order.sellerId);
  if (sellerUid) {
    await notify(sellerUid, {
      type: "order_cancelled",
      title: `Commande ${order.number} annulée par l'acheteur`,
      body:
        order.status === "paid"
          ? "L'acheteur a été remboursé, le stock est restitué."
          : "Le stock est restitué.",
      link: "/vendeur/commandes",
    });
  }

  revalidateOrderPaths(orderId);
  revalidatePath("/produits");
  return {};
}

/**
 * Confirmation de réception par l'acheteur : déblocage de l'Escrow,
 * versement au vendeur net de commission (MVP n°118, 121) et versement
 * des frais de livraison au livreur de la course (itération 6). Sans
 * livreur (auto-livraison), les frais restent à la plateforme.
 */
export async function confirmDelivery(
  orderId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const order = await getOwnOrder(user.id, orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "shipped") {
    return { error: "Cette commande n'est pas encore expédiée." };
  }

  const [seller] = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, order.sellerId))
    .limit(1);
  if (!seller) return { error: "Vendeur introuvable." };

  // Course active : le livreur a récupéré (voire remis) le colis.
  const [deliveryRow] = await db
    .select({ delivery: deliveries, courierUserId: courierProfiles.userId })
    .from(deliveries)
    .innerJoin(courierProfiles, eq(courierProfiles.id, deliveries.courierId))
    .where(
      and(
        eq(deliveries.orderId, order.id),
        inArray(deliveries.status, ["picked_up", "delivered"]),
      ),
    )
    .limit(1);

  const commission = commissionFcfa(order.subtotalFcfa);
  const sellerNet = order.subtotalFcfa - commission;

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({
        status: "delivered",
        deliveredAt: new Date(),
        commissionFcfa: commission,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, "shipped")))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new Error("conflict");

    const sellerWallet = await getOrCreateWallet(seller.userId, tx);
    await applyWalletMovement(tx, sellerWallet.id, {
      type: "sale_income",
      amountFcfa: sellerNet,
      orderId: order.id,
      description: `Vente ${order.number} — ${formatFcfa(order.subtotalFcfa)} moins ${formatFcfa(commission)} de commission (5 %)`,
    });

    if (deliveryRow) {
      // La confirmation de l'acheteur clôt la course si le livreur n'avait
      // pas encore enregistré la remise.
      if (deliveryRow.delivery.status === "picked_up") {
        await tx
          .update(deliveries)
          .set({
            status: "delivered",
            deliveredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(deliveries.id, deliveryRow.delivery.id));
      }

      const courierWallet = await getOrCreateWallet(
        deliveryRow.courierUserId,
        tx,
      );
      await applyWalletMovement(tx, courierWallet.id, {
        type: "delivery_income",
        amountFcfa: deliveryRow.delivery.feeFcfa,
        orderId: order.id,
        description: `Course ${order.number} — frais de livraison`,
      });
    }
  });

  // Versements confirmés (MVP n°306) : vendeur et livreur sont prévenus.
  await notify(seller.userId, {
    type: "order_delivered",
    title: `Commande ${order.number} livrée — fonds versés`,
    body: `${formatFcfa(sellerNet)} versés sur votre wallet (commission de 5 % déduite).`,
    link: "/compte/wallet",
    email: true,
  });
  if (deliveryRow) {
    await notify(deliveryRow.courierUserId, {
      type: "delivery_paid",
      title: `Course ${order.number} — gain versé`,
      body: `${formatFcfa(deliveryRow.delivery.feeFcfa)} versés sur votre wallet.`,
      link: "/compte/wallet",
    });
  }

  revalidateOrderPaths(orderId);
  return {};
}

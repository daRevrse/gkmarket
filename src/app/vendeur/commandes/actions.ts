"use server";

import { revalidatePath } from "next/cache";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, deliveries, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { notify } from "@/lib/notify";

// Transitions vendeur : une commande payée se prépare, puis s'expédie.
// La livraison est confirmée par l'acheteur (déblocage Escrow).
const transitions: Record<string, "paid" | "processing"> = {
  processing: "paid",
  shipped: "processing",
};

export async function advanceOrder(
  orderId: string,
  to: "processing" | "shipped",
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

  const from = transitions[to];
  const updated = await db
    .update(orders)
    .set({
      status: to,
      shippedAt: to === "shipped" ? new Date() : undefined,
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

  // L'acheteur suit l'avancement (MVP n°305).
  if (to === "shipped") {
    await notify(updated[0].buyerId, {
      type: "order_shipped",
      title: `Commande ${updated[0].number} expédiée`,
      body: "Le vendeur a expédié votre commande. Confirmez la réception à l'arrivée pour libérer les fonds.",
      link: `/compte/commandes/${updated[0].id}`,
      email: true,
    });
  }

  revalidatePath("/vendeur/commandes");
  revalidatePath("/compte/commandes");
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

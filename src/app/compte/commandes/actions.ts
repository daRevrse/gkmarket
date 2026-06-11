"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, products, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { commissionFcfa } from "@/lib/pricing";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/compte/commandes");
  revalidatePath(`/compte/commandes/${orderId}`);
  revalidatePath("/vendeur/commandes");
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

  revalidateOrderPaths(orderId);
  revalidatePath("/produits");
  return {};
}

/**
 * Confirmation de réception par l'acheteur : déblocage de l'Escrow et
 * versement au vendeur, net de commission (MVP n°118, 121).
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
  });

  revalidateOrderPaths(orderId);
  return {};
}

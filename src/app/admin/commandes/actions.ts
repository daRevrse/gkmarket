"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  deliveries,
  orderItems,
  orders,
  products,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

/**
 * Intervention manuelle admin (MVP n°252-254) : annulation d'une commande
 * non finalisée avec remboursement wallet intégral, re-stock et annulation
 * des courses non récupérées. Une commande en litige se traite via
 * l'arbitrage, pas ici.
 */
export async function adminCancelOrder(
  orderId: string,
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return { error: "Commande introuvable." };
  if (!["pending_payment", "paid", "processing", "shipped"].includes(order.status)) {
    return {
      error:
        order.status === "disputed"
          ? "Commande en litige : tranchez-la depuis l'arbitrage."
          : "Cette commande est déjà finalisée.",
    };
  }

  await db.transaction(async (tx) => {
    const updated = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new Error("conflict");

    // Remboursement intégral si l'acheteur avait payé (fonds en Escrow).
    if (order.paidAt) {
      const buyerWallet = await getOrCreateWallet(order.buyerId, tx);
      await applyWalletMovement(tx, buyerWallet.id, {
        type: "order_refund",
        amountFcfa: order.totalFcfa,
        orderId: order.id,
        description: `Remboursement commande ${order.number} annulée par GK Market`,
      });
    }

    await tx
      .update(deliveries)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(deliveries.orderId, order.id),
          inArray(deliveries.status, ["proposed", "accepted", "picked_up"]),
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

  // Les deux parties sont prévenues de l'intervention.
  await notify(order.buyerId, {
    type: "order_cancelled",
    title: `Commande ${order.number} annulée par GK Market`,
    body: order.paidAt
      ? `Vous avez été intégralement remboursé (${order.totalFcfa.toLocaleString("fr-FR")} FCFA sur votre wallet).`
      : "La commande a été annulée.",
    link: "/compte/commandes",
    email: true,
  });
  const [seller] = await db
    .select({ userId: sellerProfiles.userId })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, order.sellerId))
    .limit(1);
  if (seller) {
    await notify(seller.userId, {
      type: "order_cancelled",
      title: `Commande ${order.number} annulée par GK Market`,
      body: "Le stock a été restitué. Contactez le support pour toute question.",
      link: "/vendeur/commandes",
      email: true,
    });
  }

  revalidatePath("/admin/commandes");
  revalidatePath("/compte/commandes");
  revalidatePath("/vendeur/commandes");
  revalidatePath("/livreur/courses");
  return {};
}

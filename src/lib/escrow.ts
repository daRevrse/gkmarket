import "server-only";

import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  deliveries,
  orders,
  sellerProfiles,
} from "@/db/schema";
import { formatFcfa } from "@/lib/format";
import { notify } from "@/lib/notify";
import { commissionFcfa } from "@/lib/pricing";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

/**
 * Délai de déblocage automatique (MVP n°119, 272) : une commande expédiée
 * non confirmée (et sans litige) est considérée livrée après ce délai —
 * les fonds sont versés comme si l'acheteur avait confirmé.
 */
export const ESCROW_AUTO_RELEASE_DAYS = 7;

/**
 * Libère l'Escrow d'une commande expédiée : commande « livrée », versement
 * vendeur net de commission, frais de course au livreur (s'il a récupéré le
 * colis), clôture de la course, notifications. Utilisée par la confirmation
 * de réception de l'acheteur et par le déblocage automatique.
 */
export async function releaseEscrowForOrder(
  orderId: string,
  mode: "confirmed" | "auto",
): Promise<{ error?: string }> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);
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

  try {
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
        description: `Vente ${order.number} — ${formatFcfa(order.subtotalFcfa)} moins ${formatFcfa(commission)} de commission (5 %)${mode === "auto" ? " (déblocage automatique)" : ""}`,
      });

      if (deliveryRow) {
        // La libération clôt la course si le livreur n'avait pas encore
        // enregistré la remise.
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
  } catch {
    return { error: "Conflit : le statut de la commande a changé." };
  }

  // Notifications après commit (MVP n°306) — jamais bloquantes.
  await notify(seller.userId, {
    type: "order_delivered",
    title: `Commande ${order.number} livrée — fonds versés`,
    body: `${formatFcfa(sellerNet)} versés sur votre wallet (commission de 5 % déduite)${mode === "auto" ? " — déblocage automatique après délai." : "."}`,
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
  if (mode === "auto") {
    await notify(order.buyerId, {
      type: "order_delivered",
      title: `Commande ${order.number} clôturée automatiquement`,
      body: `Sans confirmation ni litige sous ${ESCROW_AUTO_RELEASE_DAYS} jours après l'expédition, les fonds Escrow ont été versés au vendeur.`,
      link: `/compte/commandes/${order.id}`,
      email: true,
    });
  }

  return {};
}

/**
 * Déblocage automatique (MVP n°119) : libère toutes les commandes expédiées
 * depuis plus de ESCROW_AUTO_RELEASE_DAYS jours. Retourne le nombre de
 * commandes libérées. Appelé par /api/cron/escrow (Vercel Cron en prod)
 * et opportunément depuis l'admin.
 */
export async function autoReleaseOverdueEscrows(): Promise<number> {
  const cutoff = new Date(
    Date.now() - ESCROW_AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000,
  );
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "shipped"), lt(orders.shippedAt, cutoff)));

  let released = 0;
  for (const row of rows) {
    const result = await releaseEscrowForOrder(row.id, "auto");
    if (!result.error) released += 1;
  }
  return released;
}

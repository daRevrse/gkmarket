"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  deliveries,
  disputeEvidence,
  disputeMessages,
  disputeReasonEnum,
  disputes,
  orders,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { commissionFcfa } from "@/lib/pricing";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

const MAX_EVIDENCE = 4;

function revalidateDisputePaths(orderId: string, disputeId?: string) {
  revalidatePath("/compte/commandes");
  revalidatePath(`/compte/commandes/${orderId}`);
  revalidatePath("/vendeur/commandes");
  revalidatePath("/admin/litiges");
  revalidatePath("/compte/wallet");
  if (disputeId) revalidatePath(`/litiges/${disputeId}`);
}

/**
 * Ouverture d'un litige par l'acheteur (MVP n°186-190) : possible tant que
 * les fonds sont en Escrow (commande payée, en préparation ou expédiée).
 * La commande passe en `disputed` — plus de confirmation, d'annulation ni
 * de versement jusqu'à la décision d'un admin.
 */
export async function openDispute(
  orderId: string,
  input: { reason: string; description: string; evidencePaths: string[] },
): Promise<{ error?: string; disputeId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const reason = disputeReasonEnum.enumValues.find((r) => r === input.reason);
  if (!reason) return { error: "Choisissez le motif du litige." };
  if (!input.description?.trim() || input.description.trim().length < 20) {
    return {
      error: "Décrivez le problème en détail (20 caractères minimum).",
    };
  }

  // Les preuves doivent appartenir au dossier de l'acheteur.
  const prefix = `disputes/${user.firebaseUid}/`;
  const evidencePaths = (input.evidencePaths ?? []).slice(0, MAX_EVIDENCE);
  if (evidencePaths.some((path) => !path.startsWith(prefix))) {
    return { error: "Preuve invalide." };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.buyerId, user.id)))
    .limit(1);
  if (!order) return { error: "Commande introuvable." };
  if (!["paid", "processing", "shipped"].includes(order.status)) {
    return {
      error:
        "Un litige ne peut être ouvert que sur une commande payée non finalisée.",
    };
  }

  let disputeId: string | undefined;
  try {
    await db.transaction(async (tx) => {
      // Verrou optimiste : la commande doit toujours être dans son statut.
      const updated = await tx
        .update(orders)
        .set({ status: "disputed", updatedAt: new Date() })
        .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
        .returning({ id: orders.id });
      if (updated.length === 0) throw new Error("conflict");

      const [dispute] = await tx
        .insert(disputes)
        .values({
          orderId: order.id,
          buyerId: user.id,
          sellerId: order.sellerId,
          reason,
          description: input.description.trim(),
        })
        .returning({ id: disputes.id });
      disputeId = dispute.id;

      if (evidencePaths.length > 0) {
        await tx.insert(disputeEvidence).values(
          evidencePaths.map((path, position) => ({
            disputeId: dispute.id,
            path,
            position,
          })),
        );
      }

      // Le vendeur ne doit plus expédier : les courses non récupérées
      // sont annulées.
      await tx
        .update(deliveries)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(deliveries.orderId, order.id),
            inArray(deliveries.status, ["proposed", "accepted"]),
          ),
        );
    });
  } catch {
    return {
      error: "Impossible d'ouvrir le litige (déjà ouvert ou statut modifié ?).",
    };
  }

  revalidateDisputePaths(order.id, disputeId);
  return { disputeId };
}

/** Parties prenantes d'un litige : acheteur, vendeur, admins. */
async function getDisputeForUser(disputeId: string, user: CurrentUser) {
  const [row] = await db
    .select({
      dispute: disputes,
      sellerUserId: sellerProfiles.userId,
    })
    .from(disputes)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, disputes.sellerId))
    .where(eq(disputes.id, disputeId))
    .limit(1);
  if (!row) return null;

  const isParty =
    user.isAdmin || row.dispute.buyerId === user.id || row.sellerUserId === user.id;
  return isParty ? row : null;
}

/** Message dans le fil du litige (MVP n°196, 204 — dialogue des parties). */
export async function postDisputeMessage(
  disputeId: string,
  body: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };
  if (!body?.trim()) return { error: "Le message est vide." };

  const row = await getDisputeForUser(disputeId, user);
  if (!row) return { error: "Litige introuvable." };
  if (row.dispute.status !== "open") {
    return { error: "Ce litige est clôturé." };
  }

  await db.insert(disputeMessages).values({
    disputeId,
    authorId: user.id,
    body: body.trim(),
  });

  revalidatePath(`/litiges/${disputeId}`);
  return {};
}

/**
 * Décision finale de l'admin (MVP n°200-203, 208) :
 * - `refund_total`   : l'acheteur récupère tout (commande « Remboursée ») ;
 * - `refund_partial` : dédommagement X à l'acheteur, le solde du sous-total
 *   est versé au vendeur net de commission ;
 * - `release_seller` : litige rejeté, versement normal (vendeur + livreur).
 * Le livreur garde ses frais de course dès lors qu'il a récupéré le colis,
 * sauf remboursement total (responsabilité à trancher au cas par cas via la
 * note de décision).
 */
export async function resolveDispute(
  disputeId: string,
  input: { resolution: string; refundFcfa?: number; note: string },
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Réservé aux administrateurs." };
  if (!input.note?.trim()) {
    return { error: "La note de décision est requise (visible par les parties)." };
  }

  const [row] = await db
    .select({ dispute: disputes, order: orders })
    .from(disputes)
    .innerJoin(orders, eq(orders.id, disputes.orderId))
    .where(eq(disputes.id, disputeId))
    .limit(1);
  if (!row) return { error: "Litige introuvable." };
  if (row.dispute.status !== "open" || row.order.status !== "disputed") {
    return { error: "Ce litige est déjà tranché." };
  }
  const { dispute, order } = row;

  const [seller] = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, order.sellerId))
    .limit(1);
  if (!seller) return { error: "Vendeur introuvable." };

  // Course effectuée : le livreur a récupéré (voire remis) le colis.
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

  let refund = 0;
  let sellerPart = 0;
  if (input.resolution === "refund_total") {
    refund = order.totalFcfa;
  } else if (input.resolution === "refund_partial") {
    refund = Math.floor(input.refundFcfa ?? 0);
    if (refund < 1 || refund >= order.subtotalFcfa) {
      return {
        error: `Le remboursement partiel doit être entre 1 et ${formatFcfa(order.subtotalFcfa - 1)}.`,
      };
    }
    sellerPart = order.subtotalFcfa - refund;
  } else if (input.resolution === "release_seller") {
    sellerPart = order.subtotalFcfa;
  } else {
    return { error: "Choisissez une décision." };
  }

  const commission = sellerPart > 0 ? commissionFcfa(sellerPart) : null;
  const payCourier = sellerPart > 0 && deliveryRow != null;

  await db.transaction(async (tx) => {
    const updatedDispute = await tx
      .update(disputes)
      .set({
        status: "resolved",
        resolution: input.resolution as typeof disputes.$inferInsert.resolution,
        refundFcfa: refund > 0 ? refund : null,
        decisionNote: input.note.trim(),
        resolvedById: user.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(disputes.id, disputeId), eq(disputes.status, "open")))
      .returning({ id: disputes.id });
    if (updatedDispute.length === 0) throw new Error("conflict");

    await tx
      .update(orders)
      .set({
        status: refund === order.totalFcfa ? "refunded" : "delivered",
        deliveredAt: refund === order.totalFcfa ? null : new Date(),
        commissionFcfa: commission,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, "disputed")));

    if (refund > 0) {
      const buyerWallet = await getOrCreateWallet(dispute.buyerId, tx);
      await applyWalletMovement(tx, buyerWallet.id, {
        type: "order_refund",
        amountFcfa: refund,
        orderId: order.id,
        description: `Litige ${order.number} — remboursement ${refund === order.totalFcfa ? "intégral" : "partiel"}`,
      });
    }

    if (sellerPart > 0 && commission !== null) {
      const sellerWallet = await getOrCreateWallet(seller.userId, tx);
      await applyWalletMovement(tx, sellerWallet.id, {
        type: "sale_income",
        amountFcfa: sellerPart - commission,
        orderId: order.id,
        description: `Litige ${order.number} — versement de ${formatFcfa(sellerPart)} moins ${formatFcfa(commission)} de commission (5 %)`,
      });
    }

    if (payCourier && deliveryRow) {
      if (deliveryRow.delivery.status === "picked_up") {
        await tx
          .update(deliveries)
          .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
          .where(eq(deliveries.id, deliveryRow.delivery.id));
      }
      const courierWallet = await getOrCreateWallet(deliveryRow.courierUserId, tx);
      await applyWalletMovement(tx, courierWallet.id, {
        type: "delivery_income",
        amountFcfa: deliveryRow.delivery.feeFcfa,
        orderId: order.id,
        description: `Course ${order.number} — frais de livraison (litige tranché)`,
      });
    }
  });

  revalidateDisputePaths(order.id, disputeId);
  return {};
}

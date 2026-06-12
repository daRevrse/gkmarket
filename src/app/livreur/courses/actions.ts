"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

function revalidateDeliveryPaths() {
  revalidatePath("/livreur/courses");
  revalidatePath("/vendeur/commandes");
  revalidatePath("/compte/commandes");
}

async function getOwnDelivery(deliveryId: string) {
  const user = await getCurrentUser();
  if (user?.courierProfile?.status !== "approved") return null;

  const [delivery] = await db
    .select()
    .from(deliveries)
    .where(
      and(
        eq(deliveries.id, deliveryId),
        eq(deliveries.courierId, user.courierProfile.id),
      ),
    )
    .limit(1);
  return delivery ? { delivery, user } : null;
}

/** Le livreur accepte la course proposée par le vendeur. */
export async function acceptDelivery(
  deliveryId: string,
): Promise<{ error?: string }> {
  const own = await getOwnDelivery(deliveryId);
  if (!own) return { error: "Course introuvable." };

  const updated = await db
    .update(deliveries)
    .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.status, "proposed")))
    .returning({ id: deliveries.id });
  if (updated.length === 0) {
    return { error: "Cette course n'est plus en attente d'acceptation." };
  }

  revalidateDeliveryPaths();
  return {};
}

/**
 * Le livreur peut refuser une course (cf. docs/CHANGEMENTS.md §3), avant ou
 * après acceptation tant que le colis n'est pas récupéré. Le vendeur peut
 * alors la proposer à un autre livreur.
 */
export async function refuseDelivery(
  deliveryId: string,
  reason: string,
): Promise<{ error?: string }> {
  const own = await getOwnDelivery(deliveryId);
  if (!own) return { error: "Course introuvable." };

  const updated = await db
    .update(deliveries)
    .set({
      status: "refused",
      refusalReason: reason?.trim() || null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deliveries.id, deliveryId),
        inArray(deliveries.status, ["proposed", "accepted"]),
      ),
    )
    .returning({ id: deliveries.id });
  if (updated.length === 0) {
    return { error: "Cette course ne peut plus être refusée." };
  }

  revalidateDeliveryPaths();
  return {};
}

/** Colis récupéré chez le vendeur : la commande passe en « Expédiée ». */
export async function markPickedUp(
  deliveryId: string,
): Promise<{ error?: string }> {
  const own = await getOwnDelivery(deliveryId);
  if (!own) return { error: "Course introuvable." };

  let ok = false;
  try {
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(deliveries)
        .set({
          status: "picked_up",
          pickedUpAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(deliveries.id, deliveryId), eq(deliveries.status, "accepted")),
        )
        .returning({ orderId: deliveries.orderId });
      if (updated.length === 0) return;

      // La commande doit toujours être en cours (pas annulée ni en litige).
      const orderUpdated = await tx
        .update(orders)
        .set({ status: "shipped", updatedAt: new Date() })
        .where(
          and(
            eq(orders.id, updated[0].orderId),
            inArray(orders.status, ["paid", "processing"]),
          ),
        )
        .returning({ id: orders.id });
      if (orderUpdated.length === 0) throw new Error("conflict");
      ok = true;
    });
  } catch {
    return {
      error: "La commande n'est plus en cours (annulée ou en litige ?).",
    };
  }
  if (!ok) return { error: "Cette course n'est pas en attente de récupération." };

  revalidateDeliveryPaths();
  return {};
}

/**
 * Colis remis au destinataire, avec preuve (MVP n°175, 177-178) : nom du
 * réceptionnaire, photo optionnelle, horodatage. L'acheteur confirme ensuite
 * la réception pour débloquer l'Escrow (versement vendeur + livreur).
 */
export async function markDelivered(
  deliveryId: string,
  input: { recipientName: string; proofPhotoPath?: string },
): Promise<{ error?: string }> {
  const own = await getOwnDelivery(deliveryId);
  if (!own) return { error: "Course introuvable." };

  if (!input.recipientName?.trim()) {
    return { error: "Indiquez le nom de la personne qui a reçu le colis." };
  }
  // La photo doit appartenir au dossier de preuves du livreur.
  const prefix = `proofs/${own.user.firebaseUid}/`;
  if (input.proofPhotoPath && !input.proofPhotoPath.startsWith(prefix)) {
    return { error: "Photo de preuve invalide." };
  }

  const updated = await db
    .update(deliveries)
    .set({
      status: "delivered",
      deliveredAt: new Date(),
      recipientName: input.recipientName.trim(),
      proofPhotoPath: input.proofPhotoPath || null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(deliveries.id, deliveryId), eq(deliveries.status, "picked_up")),
    )
    .returning({ id: deliveries.id });
  if (updated.length === 0) {
    return { error: "Cette course n'est pas en cours de livraison." };
  }

  revalidateDeliveryPaths();
  return {};
}

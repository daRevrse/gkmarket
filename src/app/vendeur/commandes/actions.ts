"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

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

  const from = transitions[to];
  const updated = await db
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(
      and(
        eq(orders.id, orderId),
        eq(orders.sellerId, user.sellerProfile.id),
        eq(orders.status, from),
      ),
    )
    .returning({ id: orders.id });
  if (updated.length === 0) {
    return { error: "Transition impossible (statut déjà modifié ?)." };
  }

  revalidatePath("/vendeur/commandes");
  revalidatePath("/compte/commandes");
  return {};
}

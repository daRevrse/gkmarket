"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productReviews, sellerReviews } from "@/db/schema";
import { requireApprovedSeller } from "@/lib/auth";
import { CONTACT_BLOCKED_MESSAGE } from "@/lib/contact-guard";
import { blockContactInfo } from "@/lib/moderation";
import { notify } from "@/lib/notify";

const MAX_REPLY = 1000;

/**
 * Réponse publique du vendeur à un avis (Phase 2 n°116). Une seule réponse
 * par avis, soumise au filtre anti-contournement comme tout texte public.
 */
export async function replyToReview(
  kind: "product" | "seller",
  reviewId: string,
  reply: string,
): Promise<{ error?: string; blocked?: boolean }> {
  const user = await requireApprovedSeller();
  const text = reply.trim();
  if (!text) return { error: "Votre réponse est vide." };
  if (text.length > MAX_REPLY) {
    return { error: `Réponse trop longue (${MAX_REPLY} caractères max).` };
  }
  if (await blockContactInfo(user.id, text, { context: "shop" })) {
    return { error: CONTACT_BLOCKED_MESSAGE, blocked: true };
  }

  const table = kind === "product" ? productReviews : sellerReviews;
  const [updated] = await db
    .update(table)
    .set({ sellerReply: text, repliedAt: new Date() })
    .where(
      and(eq(table.id, reviewId), eq(table.sellerId, user.sellerProfile.id)),
    )
    .returning({ buyerId: table.buyerId })
    .catch(() => []);
  if (!updated) return { error: "Avis introuvable." };

  await notify(updated.buyerId, {
    type: "review_reply",
    title: `${user.sellerProfile.shopName} a répondu à votre avis`,
    body: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    link: "/compte/avis",
  });

  revalidatePath("/vendeur/avis");
  revalidatePath("/compte/avis");
  revalidatePath(`/boutique/${user.sellerProfile.id}`);
  revalidatePath("/produits/[id]", "page");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orders,
  productReviews,
  sellerProfiles,
  sellerReviews,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CONTACT_BLOCKED_MESSAGE } from "@/lib/contact-guard";
import { blockContactInfo } from "@/lib/moderation";
import { notify } from "@/lib/notify";
import { isRating } from "@/lib/reviews";

const MAX_COMMENT = 1000;

export type ReviewInput = {
  /** Une note par article de la commande (les articles déjà notés sont ignorés). */
  products: { productId: string; rating: number; comment?: string }[];
  /** Avis sur le vendeur (une seule fois par commande). */
  seller?: {
    communication: number;
    shipping: number;
    packaging: number;
    comment?: string;
  } | null;
};

/**
 * Dépôt d'un avis après réception (docs/CHANGEMENTS.md §5, lot 5) : réservé
 * à l'acheteur d'une commande livrée - tout avis est donc un achat vérifié.
 */
export async function submitReview(
  orderId: string,
  input: ReviewInput,
): Promise<{ error?: string; blocked?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Connectez-vous pour laisser un avis." };

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.buyerId, user.id)))
    .limit(1)
    .catch(() => []);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "delivered") {
    return { error: "L'avis est possible une fois la commande reçue." };
  }

  const ratings = input.products ?? [];
  const seller = input.seller ?? null;
  if (ratings.length === 0 && !seller) {
    return { error: "Donnez au moins une note." };
  }
  for (const line of ratings) {
    if (!isRating(line.rating)) return { error: "Note invalide (1 à 5 étoiles)." };
  }
  if (
    seller &&
    (!isRating(seller.communication) ||
      !isRating(seller.shipping) ||
      !isRating(seller.packaging))
  ) {
    return { error: "Notes du vendeur invalides (1 à 5 étoiles)." };
  }

  const comments = [...ratings.map((line) => line.comment), seller?.comment]
    .map((comment) => comment?.trim())
    .filter((comment): comment is string => Boolean(comment));
  if (comments.some((comment) => comment.length > MAX_COMMENT)) {
    return { error: `Commentaire trop long (${MAX_COMMENT} caractères max).` };
  }
  if (
    comments.length > 0 &&
    (await blockContactInfo(user.id, comments.join("\n"), { context: "message" }))
  ) {
    return { error: CONTACT_BLOCKED_MESSAGE, blocked: true };
  }

  // Seuls les produits réellement commandés peuvent être notés.
  const items = await db
    .select({ productId: orderItems.productId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));
  const ordered = new Set(
    items.flatMap((item) => (item.productId ? [item.productId] : [])),
  );
  const lines = ratings.filter((line) => ordered.has(line.productId));

  await db.transaction(async (tx) => {
    if (lines.length > 0) {
      await tx
        .insert(productReviews)
        .values(
          lines.map((line) => ({
            orderId,
            productId: line.productId,
            sellerId: order.sellerId,
            buyerId: user.id,
            rating: line.rating,
            comment: line.comment?.trim() || null,
          })),
        )
        // Un article déjà noté n'est pas réécrit.
        .onConflictDoNothing();
    }
    if (seller) {
      await tx
        .insert(sellerReviews)
        .values({
          orderId,
          sellerId: order.sellerId,
          buyerId: user.id,
          communication: seller.communication,
          shipping: seller.shipping,
          packaging: seller.packaging,
          comment: seller.comment?.trim() || null,
        })
        .onConflictDoNothing();
    }
  });

  const [shop] = await db
    .select({ userId: sellerProfiles.userId })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, order.sellerId))
    .limit(1);
  if (shop) {
    await notify(shop.userId, {
      type: "review_received",
      title: `Nouvel avis sur la commande ${order.number}`,
      body: "Consultez-le et répondez depuis vos avis reçus.",
      link: "/vendeur/avis",
    });
  }

  revalidatePath("/compte/avis");
  revalidatePath(`/compte/commandes/${orderId}`);
  revalidatePath(`/boutique/${order.sellerId}`);
  // Fiches produit : route dynamique (l'URL canonique contient un slug).
  revalidatePath("/produits/[id]", "page");
  return {};
}

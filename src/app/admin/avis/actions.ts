"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productReviews, sellerReviews } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";

/**
 * Modération des avis (Phase 2 n°118) : un avis masqué disparaît des fiches,
 * des boutiques et des moyennes, sans être supprimé (trace conservée).
 */
export async function setReviewHidden(
  kind: "product" | "seller",
  reviewId: string,
  hidden: boolean,
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const table = kind === "product" ? productReviews : sellerReviews;
  const [updated] = await db
    .update(table)
    .set({ hiddenAt: hidden ? new Date() : null })
    .where(eq(table.id, reviewId))
    .returning({ id: table.id })
    .catch(() => []);
  if (!updated) return { error: "Avis introuvable." };

  await logAdmin(admin.id, hidden ? "Avis masqué" : "Avis réaffiché", {
    targetType: "avis",
    targetId: reviewId,
    details: kind === "product" ? "avis produit" : "avis vendeur",
  });

  revalidatePath("/admin/avis");
  revalidatePath("/vendeur/avis");
  revalidatePath("/compte/avis");
  revalidatePath("/produits/[id]", "page");
  return {};
}

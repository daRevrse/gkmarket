"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";

/**
 * Modération produit (MVP n°245-248) : un produit non conforme est archivé
 * (retiré du catalogue). Le vendeur peut le corriger et le republier -
 * une boutique récidiviste se suspend depuis /admin/vendeurs.
 */
export async function moderateProduct(
  productId: string,
  action: "archive" | "restore",
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const updated = await db
    .update(products)
    .set({
      status: action === "archive" ? "archived" : "published",
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning({ id: products.id, title: products.title });
  if (updated.length === 0) return { error: "Produit introuvable." };

  await logAdmin(
    admin.id,
    action === "archive" ? "Produit retiré du catalogue" : "Produit rétabli",
    { targetType: "produit", targetId: productId, details: updated[0].title },
  );

  revalidatePath("/admin/produits");
  revalidatePath("/produits");
  revalidatePath(`/produits/${productId}`);
  revalidatePath("/");
  return {};
}

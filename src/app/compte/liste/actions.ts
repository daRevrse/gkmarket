"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  productViews,
  products,
  sellerProfiles,
  wishlistItems,
} from "@/db/schema";
import { addToCart } from "@/app/panier/actions";
import { getCurrentUser } from "@/lib/auth";
import { basePriceFcfa } from "@/lib/pricing";
import { loadWishlist } from "@/lib/shopping-list";

type ToggleResult = { inList?: boolean; loginRequired?: boolean; error?: string };

/**
 * Ajoute ou retire un produit de « Ma liste ». Un visiteur non connecté est
 * invité à se connecter (la liste est liée au compte).
 */
export async function toggleWishlist(productId: string): Promise<ToggleResult> {
  const user = await getCurrentUser();
  if (!user) return { loginRequired: true };

  const removed = await db
    .delete(wishlistItems)
    .where(
      and(eq(wishlistItems.userId, user.id), eq(wishlistItems.productId, productId)),
    )
    .returning({ id: wishlistItems.id })
    .catch(() => null);
  if (removed === null) return { error: "Produit introuvable." };

  if (removed.length === 0) {
    const [row] = await db
      .select({ product: products, shopStatus: sellerProfiles.status })
      .from(products)
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
      .where(eq(products.id, productId))
      .limit(1);
    if (!row || row.product.status !== "published" || row.shopStatus !== "approved") {
      return { error: "Produit indisponible." };
    }
    await db
      .insert(wishlistItems)
      .values({
        userId: user.id,
        productId,
        priceAtAddFcfa: basePriceFcfa(row.product),
      })
      .onConflictDoNothing();
  }

  revalidatePath("/compte/liste");
  return { inList: removed.length === 0 };
}

/**
 * « Tout ajouter au panier » : chaque produit disponible de la liste entre
 * au panier à sa quantité minimum de commande. La liste est conservée.
 */
export async function addWishlistToCart(): Promise<{
  added?: number;
  skipped?: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { error: "Connectez-vous pour accéder à votre liste." };

  const items = await loadWishlist(user.id);
  let added = 0;
  for (const item of items) {
    const available =
      item.status === "published" && item.shopStatus === "approved" && item.stock > 0;
    if (!available) continue;
    const result = await addToCart(item.productId, item.minOrderQty);
    if (!result.error) added += 1;
  }
  revalidatePath("/panier");
  return { added, skipped: items.length - added };
}

/** Efface l'historique « Vus récemment ». */
export async function clearRecentlyViewed(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db.delete(productViews).where(eq(productViews.userId, user.id));
  revalidatePath("/compte/liste");
}

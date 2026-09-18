import "server-only";

import { and, desc, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  productImages,
  productViews,
  products,
  sellerProfiles,
  wishlistItems,
} from "@/db/schema";
import { publishedProducts } from "@/lib/catalog";

// « Ma liste » et « Vus récemment » (docs/CHANGEMENTS.md §5, lot 2).

/** Taille de l'historique « Vus récemment » conservé par compte. */
const RECENT_VIEWS_KEPT = 50;

/** Produits de « Ma liste » d'un compte (identifiants). */
export async function wishlistProductIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ productId: wishlistItems.productId })
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId));
  return rows.map((row) => row.productId);
}

export async function isInWishlist(
  userId: string,
  productId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: wishlistItems.id })
    .from(wishlistItems)
    .where(
      and(eq(wishlistItems.userId, userId), eq(wishlistItems.productId, productId)),
    )
    .limit(1);
  return Boolean(row);
}

/** « Ma liste » détaillée, la plus récente en premier (produits retirés compris). */
export async function loadWishlist(userId: string) {
  return db
    .select({
      productId: products.id,
      title: products.title,
      priceFcfa: products.priceFcfa,
      wholesalePriceFcfa: products.wholesalePriceFcfa,
      wholesaleMinQty: products.wholesaleMinQty,
      promoPriceFcfa: products.promoPriceFcfa,
      promoEndsAt: products.promoEndsAt,
      stock: products.stock,
      minOrderQty: products.minOrderQty,
      status: products.status,
      shopName: sellerProfiles.shopName,
      shopStatus: sellerProfiles.status,
      imageUrl: productImages.url,
      priceAtAddFcfa: wishlistItems.priceAtAddFcfa,
      addedAt: wishlistItems.createdAt,
    })
    .from(wishlistItems)
    .innerJoin(products, eq(products.id, wishlistItems.productId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.position, 0)),
    )
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt));
}

/** Derniers produits consultés, encore en ligne. */
export async function loadRecentlyViewed(userId: string, limit = 12) {
  return publishedProducts()
    .innerJoin(
      productViews,
      and(
        eq(productViews.productId, products.id),
        eq(productViews.userId, userId),
      ),
    )
    .where(eq(products.status, "published"))
    .orderBy(desc(productViews.viewedAt))
    .limit(limit);
}

/**
 * Mémorise la consultation d'une fiche produit et borne l'historique.
 * Best-effort : appelé après la réponse (after), ne lève jamais.
 */
export async function recordProductView(
  userId: string,
  productId: string,
): Promise<void> {
  try {
    await db
      .insert(productViews)
      .values({ userId, productId })
      .onConflictDoUpdate({
        target: [productViews.userId, productViews.productId],
        set: { viewedAt: new Date() },
      });
    const kept = db
      .select({ productId: productViews.productId })
      .from(productViews)
      .where(eq(productViews.userId, userId))
      .orderBy(desc(productViews.viewedAt))
      .limit(RECENT_VIEWS_KEPT);
    await db
      .delete(productViews)
      .where(
        and(
          eq(productViews.userId, userId),
          notInArray(productViews.productId, kept),
        ),
      );
  } catch {
    // Historique indisponible : sans incidence sur la navigation.
  }
}

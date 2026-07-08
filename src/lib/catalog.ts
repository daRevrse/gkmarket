import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products, sellerProfiles } from "@/db/schema";

/** Projection commune des cartes produit (catalogue, vitrine, rayons). */
export const catalogSelection = {
  id: products.id,
  title: products.title,
  priceFcfa: products.priceFcfa,
  wholesalePriceFcfa: products.wholesalePriceFcfa,
  stock: products.stock,
  promoPriceFcfa: products.promoPriceFcfa,
  promoEndsAt: products.promoEndsAt,
  imageUrl: productImages.url,
  shopName: sellerProfiles.shopName,
};

/**
 * Base de requête des produits publiés par des boutiques approuvées,
 * avec photo principale. Compléter par `.where(...)`, `.orderBy(...)`, etc.
 */
export function publishedProducts() {
  return db
    .select(catalogSelection)
    .from(products)
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.position, 0)),
    )
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    );
}

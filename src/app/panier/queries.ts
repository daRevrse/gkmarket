import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, productImages, products, sellerProfiles } from "@/db/schema";
import {
  DELIVERY_FEE_PER_SELLER_FCFA,
  unitPriceFcfa,
  isWholesaleApplied,
} from "@/lib/pricing";

export type CartLine = {
  itemId: string;
  productId: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  minOrderQty: number;
  stock: number;
  unitPrice: number;
  wholesaleApplied: boolean;
  lineTotal: number;
};

export type SellerGroup = {
  sellerId: string;
  shopName: string;
  lines: CartLine[];
  subtotal: number;
  deliveryFee: number;
};

export type CartSummary = {
  groups: SellerGroup[];
  itemCount: number;
  subtotal: number;
  deliveryTotal: number;
  total: number;
};

/** Panier complet, groupé par vendeur, prix de gros appliqués. */
export async function getCart(userId: string): Promise<CartSummary> {
  const rows = await db
    .select({
      item: cartItems,
      product: products,
      shopName: sellerProfiles.shopName,
      imageUrl: productImages.url,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0),
      ),
    )
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.createdAt));

  const groups = new Map<string, SellerGroup>();
  for (const row of rows) {
    // Les produits dépubliés entre-temps restent visibles mais le checkout les bloque.
    const unitPrice = unitPriceFcfa(row.product, row.item.quantity);
    const line: CartLine = {
      itemId: row.item.id,
      productId: row.product.id,
      title: row.product.title,
      imageUrl: row.imageUrl,
      quantity: row.item.quantity,
      minOrderQty: row.product.minOrderQty,
      stock: row.product.stock,
      unitPrice,
      wholesaleApplied: isWholesaleApplied(row.product, row.item.quantity),
      lineTotal: unitPrice * row.item.quantity,
    };
    const group = groups.get(row.product.sellerId) ?? {
      sellerId: row.product.sellerId,
      shopName: row.shopName,
      lines: [],
      subtotal: 0,
      deliveryFee: DELIVERY_FEE_PER_SELLER_FCFA,
    };
    group.lines.push(line);
    group.subtotal += line.lineTotal;
    groups.set(row.product.sellerId, group);
  }

  const groupList = [...groups.values()];
  const subtotal = groupList.reduce((sum, group) => sum + group.subtotal, 0);
  const deliveryTotal = groupList.reduce(
    (sum, group) => sum + group.deliveryFee,
    0,
  );
  return {
    groups: groupList,
    itemCount: rows.reduce((sum, row) => sum + row.item.quantity, 0),
    subtotal,
    deliveryTotal,
    total: subtotal + deliveryTotal,
  };
}

import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, productImages, products, sellerProfiles } from "@/db/schema";
import {
  DELIVERY_FEE_PER_SELLER_FCFA,
  unitPriceFcfa,
  isWholesaleApplied,
} from "@/lib/pricing";
import type { GuestCartItem } from "@/lib/guest-cart";

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

type CartRow = {
  itemId: string;
  product: typeof products.$inferSelect;
  shopName: string;
  imageUrl: string | null;
  quantity: number;
};

const EMPTY_CART: CartSummary = {
  groups: [],
  itemCount: 0,
  subtotal: 0,
  deliveryTotal: 0,
  total: 0,
};

/** Construit le récapitulatif (groupé par vendeur, prix de gros appliqués). */
function buildCartSummary(rows: CartRow[]): CartSummary {
  const groups = new Map<string, SellerGroup>();
  for (const row of rows) {
    // Les produits dépubliés entre-temps restent visibles mais le checkout les bloque.
    const unitPrice = unitPriceFcfa(row.product, row.quantity);
    const line: CartLine = {
      itemId: row.itemId,
      productId: row.product.id,
      title: row.product.title,
      imageUrl: row.imageUrl,
      quantity: row.quantity,
      minOrderQty: row.product.minOrderQty,
      stock: row.product.stock,
      unitPrice,
      wholesaleApplied: isWholesaleApplied(row.product, row.quantity),
      lineTotal: unitPrice * row.quantity,
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
    itemCount: rows.reduce((sum, row) => sum + row.quantity, 0),
    subtotal,
    deliveryTotal,
    total: subtotal + deliveryTotal,
  };
}

/** Panier d'un utilisateur connecté (stocké en base). */
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

  return buildCartSummary(
    rows.map((row) => ({
      itemId: row.item.id,
      product: row.product,
      shopName: row.shopName,
      imageUrl: row.imageUrl,
      quantity: row.item.quantity,
    })),
  );
}

/**
 * Panier « invité » (cookie). L'identifiant de ligne est le productId
 * (pas de ligne en base) ; les produits indisponibles sont ignorés.
 */
export async function getGuestCart(
  items: GuestCartItem[],
): Promise<CartSummary> {
  if (items.length === 0) return EMPTY_CART;

  const rows = await db
    .select({
      product: products,
      shopName: sellerProfiles.shopName,
      imageUrl: productImages.url,
    })
    .from(products)
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    )
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0),
      ),
    )
    .where(
      and(
        inArray(
          products.id,
          items.map((i) => i.productId),
        ),
        eq(products.status, "published"),
      ),
    );

  const byId = new Map(rows.map((row) => [row.product.id, row]));
  const cartRows = items
    .map((item): CartRow | null => {
      const row = byId.get(item.productId);
      return row
        ? {
            itemId: row.product.id,
            product: row.product,
            shopName: row.shopName,
            imageUrl: row.imageUrl,
            quantity: item.quantity,
          }
        : null;
    })
    .filter((row): row is CartRow => row !== null);

  return buildCartSummary(cartRows);
}

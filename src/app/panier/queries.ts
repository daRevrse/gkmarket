import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, productImages, products, sellerProfiles } from "@/db/schema";
import { feeFromPct } from "@/lib/orders";
import { loadAcceptablePurchaseOrder } from "@/lib/purchase-orders";
import { unitPriceFcfa, isWholesaleApplied } from "@/lib/pricing";
import { getPlatformSettings, type PlatformSettings } from "@/lib/settings";
import type { GuestCartItem } from "@/lib/guest-cart";

export type CartLine = {
  itemId: string;
  /** Null pour une ligne libre de bon de commande. */
  productId: string | null;
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
  /** Frais de service de la commande de ce vendeur. */
  serviceFee: number;
};

export type CartSummary = {
  groups: SellerGroup[];
  itemCount: number;
  subtotal: number;
  deliveryTotal: number;
  serviceFeeTotal: number;
  serviceFeePct: number;
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
  serviceFeeTotal: 0,
  serviceFeePct: 0,
  total: 0,
};

/**
 * Construit le récapitulatif (groupé par vendeur, prix de gros appliqués).
 * Une commande par vendeur : livraison et frais de service par groupe.
 */
function buildCartSummary(
  rows: CartRow[],
  settings: PlatformSettings,
): CartSummary {
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
      deliveryFee: settings.deliveryFeeFcfa,
      serviceFee: 0,
    };
    group.lines.push(line);
    group.subtotal += line.lineTotal;
    groups.set(row.product.sellerId, group);
  }

  const groupList = [...groups.values()];
  for (const group of groupList) {
    group.serviceFee = feeFromPct(group.subtotal, settings.serviceFeePct);
  }
  return summarizeGroups(
    groupList,
    rows.reduce((sum, row) => sum + row.quantity, 0),
    settings.serviceFeePct,
  );
}

/** Totaux d'un récapitulatif à partir de ses groupes vendeur. */
export function summarizeGroups(
  groups: SellerGroup[],
  itemCount: number,
  serviceFeePct: number,
): CartSummary {
  const sumOf = (pick: (group: SellerGroup) => number) =>
    groups.reduce((sum, group) => sum + pick(group), 0);
  const subtotal = sumOf((group) => group.subtotal);
  const deliveryTotal = sumOf((group) => group.deliveryFee);
  const serviceFeeTotal = sumOf((group) => group.serviceFee);
  return {
    groups,
    itemCount,
    subtotal,
    deliveryTotal,
    serviceFeeTotal,
    serviceFeePct,
    total: subtotal + deliveryTotal + serviceFeeTotal,
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
    await getPlatformSettings(),
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

  return buildCartSummary(cartRows, await getPlatformSettings());
}

/**
 * Achat direct (« Acheter maintenant ») : récapitulatif d'un seul article,
 * sans passer par le panier. Quantité ramenée entre le minimum de commande
 * et le stock ; null si le produit n'est pas achetable.
 */
export async function getDirectPurchase(
  productId: string,
  quantity: number,
): Promise<{ summary: CartSummary; quantity: number } | null> {
  const [row] = await db
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
    .where(and(eq(products.id, productId), eq(products.status, "published")))
    .limit(1)
    .catch(() => []);
  if (!row || row.product.stock < row.product.minOrderQty) return null;

  const clamped = Math.max(
    row.product.minOrderQty,
    Math.min(Number.isInteger(quantity) ? quantity : 1, row.product.stock),
  );
  const settings = await getPlatformSettings();
  return {
    quantity: clamped,
    summary: buildCartSummary(
      [
        {
          itemId: row.product.id,
          product: row.product,
          shopName: row.shopName,
          imageUrl: row.imageUrl,
          quantity: clamped,
        },
      ],
      settings,
    ),
  };
}

/**
 * Bon de commande à accepter : récapitulatif aux prix négociés (lignes du
 * bon, livraison fixée par le vendeur) + frais de service, ou motif du refus.
 */
export async function getPurchaseOrderCheckout(
  purchaseOrderId: string,
  buyerId: string,
): Promise<
  | { error: string }
  | {
      summary: CartSummary;
      number: string;
      shopName: string;
      expiresAt: Date;
      note: string | null;
    }
> {
  const loaded = await loadAcceptablePurchaseOrder(purchaseOrderId, buyerId);
  if ("error" in loaded) {
    return { error: loaded.error ?? "Bon de commande invalide." };
  }
  const { po, shopName, items } = loaded;

  const { serviceFeePct } = await getPlatformSettings();
  const group: SellerGroup = {
    sellerId: po.sellerId,
    shopName,
    lines: items.map((item) => ({
      itemId: item.id,
      productId: item.productId,
      title: item.title,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      minOrderQty: 1,
      stock: item.quantity,
      unitPrice: item.unitPriceFcfa,
      wholesaleApplied: false,
      lineTotal: item.totalFcfa,
    })),
    subtotal: po.subtotalFcfa,
    deliveryFee: po.deliveryFeeFcfa,
    serviceFee: feeFromPct(po.subtotalFcfa, serviceFeePct),
  };
  return {
    summary: summarizeGroups(
      [group],
      items.reduce((sum, item) => sum + item.quantity, 0),
      serviceFeePct,
    ),
    number: po.number,
    shopName,
    expiresAt: po.expiresAt,
    note: po.note,
  };
}

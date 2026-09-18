import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  orders,
  products,
  purchaseOrderItems,
  purchaseOrders,
  sellerProfiles,
} from "@/db/schema";
import type {
  CatalogOption,
  PurchaseOrderPrefill,
} from "@/components/messaging/purchase-order-form";
import { basePriceFcfa } from "@/lib/pricing";

// Bons de commande émis dans le chat (docs/CHANGEMENTS.md §5, lot 3).

/** Durées de validité proposées au vendeur, en heures. */
export const PURCHASE_ORDER_VALIDITY_HOURS = [24, 48, 72, 168] as const;
export const PURCHASE_ORDER_MAX_LINES = 20;

export type PurchaseOrderState =
  | "sent"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

/** Numéro unique BC-AAMMJJ-XXXX. */
export function generatePurchaseOrderNumber(): string {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BC-${date}-${suffix}`;
}

/** État affiché : un bon envoyé dont l'échéance est passée est « expiré ». */
export function purchaseOrderState(
  po: { status: (typeof purchaseOrders.$inferSelect)["status"]; expiresAt: Date },
  now = new Date(),
): PurchaseOrderState {
  return po.status === "sent" && po.expiresAt <= now ? "expired" : po.status;
}

export type PurchaseOrderView = {
  id: string;
  number: string;
  state: PurchaseOrderState;
  subtotalFcfa: number;
  deliveryFeeFcfa: number;
  note: string | null;
  expiresAt: Date;
  declineReason: string | null;
  items: {
    productId: string | null;
    title: string;
    imageUrl: string | null;
    quantity: number;
    unitPriceFcfa: number;
    totalFcfa: number;
  }[];
  order: { id: string; number: string; status: string; totalFcfa: number } | null;
};

/** Bons de commande à afficher dans un fil (cartes à jour de leur état). */
export async function loadPurchaseOrderViews(
  ids: string[],
): Promise<Record<string, PurchaseOrderView>> {
  if (ids.length === 0) return {};
  const [rows, items] = await Promise.all([
    db
      .select({ po: purchaseOrders, order: orders })
      .from(purchaseOrders)
      .leftJoin(orders, eq(orders.id, purchaseOrders.orderId))
      .where(inArray(purchaseOrders.id, ids)),
    db
      .select()
      .from(purchaseOrderItems)
      .where(inArray(purchaseOrderItems.purchaseOrderId, ids))
      .orderBy(asc(purchaseOrderItems.position)),
  ]);

  const views: Record<string, PurchaseOrderView> = {};
  for (const { po, order } of rows) {
    views[po.id] = {
      id: po.id,
      number: po.number,
      state: purchaseOrderState(po),
      subtotalFcfa: po.subtotalFcfa,
      deliveryFeeFcfa: po.deliveryFeeFcfa,
      note: po.note,
      expiresAt: po.expiresAt,
      declineReason: po.declineReason,
      items: [],
      order: order
        ? {
            id: order.id,
            number: order.number,
            status: order.status,
            totalFcfa: order.totalFcfa,
          }
        : null,
    };
  }
  for (const item of items) {
    views[item.purchaseOrderId]?.items.push({
      productId: item.productId,
      title: item.title,
      imageUrl: item.imageUrl,
      quantity: item.quantity,
      unitPriceFcfa: item.unitPriceFcfa,
      totalFcfa: item.totalFcfa,
    });
  }
  return views;
}

/**
 * Bon de commande que l'acheteur peut encore accepter (envoyé, non expiré,
 * boutique active), avec ses lignes — ou le motif du refus.
 */
export async function loadAcceptablePurchaseOrder(
  purchaseOrderId: string,
  buyerId: string,
) {
  const [row] = await db
    .select({ po: purchaseOrders, shopName: sellerProfiles.shopName, shopStatus: sellerProfiles.status })
    .from(purchaseOrders)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, purchaseOrders.sellerId))
    .where(
      and(
        eq(purchaseOrders.id, purchaseOrderId),
        eq(purchaseOrders.buyerId, buyerId),
      ),
    )
    .limit(1)
    .catch(() => []);
  if (!row) return { error: "Bon de commande introuvable." } as const;

  const state = purchaseOrderState(row.po);
  if (state !== "sent") {
    return {
      error:
        state === "expired"
          ? "Ce bon de commande a expiré : demandez-en un nouveau au vendeur."
          : "Ce bon de commande n'est plus valable.",
    } as const;
  }
  if (row.shopStatus !== "approved") {
    return { error: "Cette boutique est momentanément indisponible." } as const;
  }

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId))
    .orderBy(asc(purchaseOrderItems.position));
  return { po: row.po, shopName: row.shopName, items } as const;
}

/** Produits en ligne d'une boutique (sélecteurs des devis et bons). */
export async function loadShopCatalog(sellerId: string): Promise<CatalogOption[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.sellerId, sellerId), eq(products.status, "published")))
    .orderBy(asc(products.title))
    .limit(300);
  return rows.map((product) => ({
    id: product.id,
    title: product.title,
    priceFcfa: basePriceFcfa(product),
    stock: product.stock,
  }));
}

/**
 * Préremplissage du formulaire vendeur depuis l'URL du fil :
 * `?bon=nouveau[&produit=…&qte=…]` (réponse à un devis ou à une fiche
 * produit) ou `?bon=modifier&id=…` (bon encore ouvert de la conversation).
 */
export async function purchaseOrderPrefill(
  conversationId: string,
  catalog: CatalogOption[],
  params: { bon?: string; produit?: string; qte?: string; id?: string },
): Promise<PurchaseOrderPrefill | undefined> {
  if (params.bon === "nouveau") {
    const product = catalog.find((option) => option.id === params.produit);
    const quantity = Math.max(1, Math.round(Number(params.qte)) || 1);
    return {
      lines: product
        ? [
            {
              productId: product.id,
              title: product.title,
              quantity,
              unitPriceFcfa: product.priceFcfa,
            },
          ]
        : [],
    };
  }
  if (params.bon === "modifier" && params.id) {
    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, params.id),
          eq(purchaseOrders.conversationId, conversationId),
          eq(purchaseOrders.status, "sent"),
        ),
      )
      .limit(1)
      .catch(() => []);
    if (!po) return undefined;
    const items = await db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, po.id))
      .orderBy(asc(purchaseOrderItems.position));
    return {
      lines: items.map((item) => ({
        productId: item.productId,
        title: item.title,
        quantity: item.quantity,
        unitPriceFcfa: item.unitPriceFcfa,
      })),
      deliveryFeeFcfa: po.deliveryFeeFcfa,
      note: po.note,
      replace: { id: po.id, number: po.number },
    };
  }
  return undefined;
}

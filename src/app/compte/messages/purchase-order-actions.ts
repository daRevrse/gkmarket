"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  productImages,
  products,
  purchaseOrderItems,
  purchaseOrders,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CONTACT_BLOCKED_MESSAGE } from "@/lib/contact-guard";
import {
  deliver,
  getConversation,
  openAsParty,
  refreshConversation,
} from "@/lib/conversation-party";
import { formatFcfa } from "@/lib/format";
import { blockContactInfo } from "@/lib/moderation";
import { notify } from "@/lib/notify";
import { basePriceFcfa } from "@/lib/pricing";
import {
  generatePurchaseOrderNumber,
  PURCHASE_ORDER_MAX_LINES,
  PURCHASE_ORDER_VALIDITY_HOURS,
} from "@/lib/purchase-orders";

// Devis et bons de commande dans le chat (docs/CHANGEMENTS.md §5, lot 3).

type ActionResult = { error?: string; blocked?: boolean };

const MAX_QUANTITY = 1_000_000;
const MAX_UNIT_PRICE = 100_000_000;
const MAX_DELIVERY_FEE = 1_000_000;

function isCount(value: number, max: number) {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

/**
 * Demande de devis (acheteur) : produit de la boutique optionnel, quantité
 * souhaitée et précisions. Le vendeur y répond par un bon de commande.
 */
export async function requestQuote(
  conversationId: string,
  input: { productId?: string | null; quantity: number; note?: string },
): Promise<ActionResult> {
  const party = await openAsParty(conversationId);
  if ("error" in party) return { error: party.error };
  if (!party.isBuyer) return { error: "Réservé à l'acheteur." };

  if (!isCount(input.quantity, MAX_QUANTITY)) {
    return { error: "Indiquez une quantité valide." };
  }
  const note = input.note?.trim() || null;
  if (note && note.length > 1000) {
    return { error: "Précisions trop longues (1000 caractères max)." };
  }
  if (
    note &&
    (await blockContactInfo(party.user.id, note, {
      context: "message",
      conversationId,
    }))
  ) {
    return { error: CONTACT_BLOCKED_MESSAGE, blocked: true };
  }

  let product: {
    id: string;
    title: string;
    imageUrl: string | null;
    priceFcfa: number;
    minOrderQty: number;
  } | null = null;
  if (input.productId) {
    const [row] = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, input.productId),
          eq(products.sellerId, party.row.conversation.sellerId),
          eq(products.status, "published"),
        ),
      )
      .limit(1)
      .catch(() => []);
    if (!row) return { error: "Ce produit n'est plus disponible." };
    const [image] = await db
      .select({ url: productImages.url })
      .from(productImages)
      .where(eq(productImages.productId, row.id))
      .orderBy(asc(productImages.position))
      .limit(1);
    product = {
      id: row.id,
      title: row.title,
      imageUrl: image?.url ?? null,
      priceFcfa: basePriceFcfa(row),
      minOrderQty: row.minOrderQty,
    };
  }

  await deliver(party, {
    kind: "quote_request",
    body: note ?? "",
    productId: product?.id,
    meta: {
      quote: { quantity: input.quantity, note },
      ...(product
        ? {
            product: {
              title: product.title,
              imageUrl: product.imageUrl,
              priceFcfa: product.priceFcfa,
              minOrderQty: product.minOrderQty,
            },
          }
        : {}),
    },
  });
  return {};
}

export type PurchaseOrderLineInput = {
  /** Produit du catalogue ; absent pour une ligne libre. */
  productId?: string | null;
  /** Intitulé d'une ligne libre. */
  title?: string;
  quantity: number;
  unitPriceFcfa: number;
};

export type PurchaseOrderInput = {
  lines: PurchaseOrderLineInput[];
  deliveryFeeFcfa: number;
  validityHours: number;
  note?: string;
};

/**
 * Émission d'un bon de commande (vendeur) : produits de sa boutique ou
 * lignes libres, prix et livraison librement fixés, durée de validité. Avec
 * `replaceId`, le bon précédent (encore ouvert) est annulé et remplacé.
 */
export async function createPurchaseOrder(
  conversationId: string,
  input: PurchaseOrderInput,
  replaceId?: string,
): Promise<ActionResult> {
  const party = await openAsParty(conversationId);
  if ("error" in party) return { error: party.error };
  if (party.isBuyer) return { error: "Réservé au vendeur." };
  const sellerId = party.row.conversation.sellerId;

  const lines = input.lines ?? [];
  if (lines.length === 0) return { error: "Ajoutez au moins une ligne." };
  if (lines.length > PURCHASE_ORDER_MAX_LINES) {
    return { error: `${PURCHASE_ORDER_MAX_LINES} lignes maximum.` };
  }
  for (const line of lines) {
    if (!isCount(line.quantity, MAX_QUANTITY)) {
      return { error: "Chaque ligne doit avoir une quantité valide." };
    }
    if (!isCount(line.unitPriceFcfa, MAX_UNIT_PRICE)) {
      return { error: "Chaque ligne doit avoir un prix unitaire valide (FCFA)." };
    }
    if (!line.productId) {
      const title = line.title?.trim() ?? "";
      if (title.length < 2 || title.length > 120) {
        return { error: "Donnez un intitulé (2 à 120 caractères) à chaque ligne libre." };
      }
    }
  }
  const deliveryFee = Math.round(Number(input.deliveryFeeFcfa));
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0 || deliveryFee > MAX_DELIVERY_FEE) {
    return { error: "Frais de livraison invalides." };
  }
  if (!(PURCHASE_ORDER_VALIDITY_HOURS as readonly number[]).includes(input.validityHours)) {
    return { error: "Choisissez une durée de validité." };
  }
  const note = input.note?.trim() || null;
  if (note && note.length > 1000) {
    return { error: "Note trop longue (1000 caractères max)." };
  }

  // Anti-contournement : note et intitulés libres.
  const freeText = [note, ...lines.map((line) => (line.productId ? null : line.title))]
    .filter(Boolean)
    .join("\n");
  if (
    freeText &&
    (await blockContactInfo(party.user.id, freeText, {
      context: "message",
      conversationId,
    }))
  ) {
    return { error: CONTACT_BLOCKED_MESSAGE, blocked: true };
  }

  // Produits : de la boutique, en ligne, stock suffisant.
  const productIds = [
    ...new Set(lines.flatMap((line) => (line.productId ? [line.productId] : []))),
  ];
  const catalog = new Map(
    productIds.length > 0
      ? (
          await db
            .select({ product: products, imageUrl: productImages.url })
            .from(products)
            .leftJoin(
              productImages,
              and(
                eq(productImages.productId, products.id),
                eq(productImages.position, 0),
              ),
            )
            .where(
              and(
                inArray(products.id, productIds),
                eq(products.sellerId, sellerId),
                eq(products.status, "published"),
              ),
            )
            .catch(() => [])
        ).map((row) => [row.product.id, row])
      : [],
  );
  const items: Omit<typeof purchaseOrderItems.$inferInsert, "purchaseOrderId">[] = [];
  for (const [index, line] of lines.entries()) {
    const entry = line.productId ? catalog.get(line.productId) : null;
    if (line.productId && !entry) {
      return { error: "Un produit du bon n'est plus disponible dans votre boutique." };
    }
    if (entry && line.quantity > entry.product.stock) {
      return {
        error: `Stock insuffisant pour « ${entry.product.title} » (${entry.product.stock} disponible${entry.product.stock > 1 ? "s" : ""}).`,
      };
    }
    items.push({
      productId: entry?.product.id ?? null,
      title: entry?.product.title ?? line.title!.trim(),
      imageUrl: entry?.imageUrl ?? null,
      unitPriceFcfa: line.unitPriceFcfa,
      quantity: line.quantity,
      totalFcfa: line.unitPriceFcfa * line.quantity,
      position: index,
    });
  }
  const subtotal = items.reduce((sum, item) => sum + item.totalFcfa, 0);

  const number = generatePurchaseOrderNumber();
  let purchaseOrderId: string;
  try {
    purchaseOrderId = await db.transaction(async (tx) => {
      if (replaceId) {
        const replaced = await tx
          .update(purchaseOrders)
          .set({ status: "cancelled", respondedAt: new Date() })
          .where(
            and(
              eq(purchaseOrders.id, replaceId),
              eq(purchaseOrders.conversationId, conversationId),
              eq(purchaseOrders.status, "sent"),
            ),
          )
          .returning({ id: purchaseOrders.id });
        if (replaced.length === 0) throw new Error("replace");
      }
      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          number,
          conversationId,
          sellerId,
          buyerId: party.row.conversation.buyerId,
          subtotalFcfa: subtotal,
          deliveryFeeFcfa: deliveryFee,
          note,
          expiresAt: new Date(Date.now() + input.validityHours * 3_600_000),
        })
        .returning({ id: purchaseOrders.id });
      await tx
        .insert(purchaseOrderItems)
        .values(items.map((item) => ({ ...item, purchaseOrderId: po.id })));
      return po.id;
    });
  } catch (err) {
    if (err instanceof Error && err.message === "replace") {
      return { error: "Le bon à modifier n'est plus ouvert (accepté, refusé ou annulé)." };
    }
    throw err;
  }

  await deliver(party, {
    kind: "purchase_order",
    body: "",
    purchaseOrderId,
    meta: { purchaseOrder: { number } },
  });
  return {};
}

/** Annulation d'un bon encore ouvert (vendeur). */
export async function cancelPurchaseOrder(
  purchaseOrderId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (user?.sellerProfile?.status !== "approved") {
    return { error: "Réservé au vendeur." };
  }
  const [cancelled] = await db
    .update(purchaseOrders)
    .set({ status: "cancelled", respondedAt: new Date() })
    .where(
      and(
        eq(purchaseOrders.id, purchaseOrderId),
        eq(purchaseOrders.sellerId, user.sellerProfile.id),
        eq(purchaseOrders.status, "sent"),
      ),
    )
    .returning()
    .catch(() => []);
  if (!cancelled) return { error: "Ce bon n'est plus ouvert." };

  const row = await getConversation(cancelled.conversationId);
  if (row) await refreshConversation(row);
  await notify(cancelled.buyerId, {
    type: "purchase_order_cancelled",
    title: `Bon de commande ${cancelled.number} annulé`,
    body: "Le vendeur a retiré ce bon de commande.",
    link: `/compte/messages/${cancelled.conversationId}`,
  });
  return {};
}

/** Refus d'un bon par l'acheteur, avec un motif facultatif. */
export async function declinePurchaseOrder(
  purchaseOrderId: string,
  reason?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Connectez-vous." };

  const motive = reason?.trim() || null;
  if (motive && motive.length > 300) {
    return { error: "Motif trop long (300 caractères max)." };
  }
  if (
    motive &&
    (await blockContactInfo(user.id, motive, { context: "message" }))
  ) {
    return { error: CONTACT_BLOCKED_MESSAGE, blocked: true };
  }

  const [declined] = await db
    .update(purchaseOrders)
    .set({ status: "declined", declineReason: motive, respondedAt: new Date() })
    .where(
      and(
        eq(purchaseOrders.id, purchaseOrderId),
        eq(purchaseOrders.buyerId, user.id),
        eq(purchaseOrders.status, "sent"),
      ),
    )
    .returning()
    .catch(() => []);
  if (!declined) return { error: "Ce bon n'est plus ouvert." };

  const row = await getConversation(declined.conversationId);
  if (row) {
    await refreshConversation(row);
    await notify(row.sellerUserId, {
      type: "purchase_order_declined",
      title: `Bon de commande ${declined.number} refusé`,
      body: `Montant des articles : ${formatFcfa(declined.subtotalFcfa)}.${motive ? ` Motif : ${motive}` : ""}`,
      link: `/vendeur/messages/${declined.conversationId}`,
    });
  }
  return {};
}

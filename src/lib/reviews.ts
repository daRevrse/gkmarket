import "server-only";

import { and, avg, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orders,
  productReviews,
  products,
  sellerReviews,
  users,
} from "@/db/schema";

// Avis (docs/CHANGEMENTS.md §5, lot 5) : réservés aux commandes livrées,
// donc toujours « achat vérifié ». Les avis masqués par la modération sont
// exclus des listes comme des moyennes.

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export function isRating(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_RATING &&
    value <= MAX_RATING
  );
}

export type RatingSummary = {
  average: number;
  count: number;
  /** Nombre d'avis par note, de 1 à 5 étoiles. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

const EMPTY_SUMMARY: RatingSummary = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

function summarize(rows: { rating: number; n: number }[]): RatingSummary {
  const distribution = { ...EMPTY_SUMMARY.distribution };
  let total = 0;
  let sum = 0;
  for (const row of rows) {
    const rating = row.rating as 1 | 2 | 3 | 4 | 5;
    distribution[rating] = row.n;
    total += row.n;
    sum += row.n * row.rating;
  }
  return total === 0
    ? EMPTY_SUMMARY
    : { average: sum / total, count: total, distribution };
}

/** Note moyenne et répartition des avis d'un produit. */
export async function productRating(productId: string): Promise<RatingSummary> {
  const rows = await db
    .select({ rating: productReviews.rating, n: count() })
    .from(productReviews)
    .where(
      and(eq(productReviews.productId, productId), isNull(productReviews.hiddenAt)),
    )
    .groupBy(productReviews.rating);
  return summarize(rows);
}

/** Notes moyennes de plusieurs produits (cartes, listes). */
export async function productRatings(
  productIds: string[],
): Promise<Map<string, { average: number; count: number }>> {
  if (productIds.length === 0) return new Map();
  const rows = await db
    .select({
      productId: productReviews.productId,
      average: avg(productReviews.rating),
      n: count(),
    })
    .from(productReviews)
    .where(
      and(
        inArray(productReviews.productId, productIds),
        isNull(productReviews.hiddenAt),
      ),
    )
    .groupBy(productReviews.productId);
  return new Map(
    rows.map((row) => [
      row.productId,
      { average: Number(row.average ?? 0), count: row.n },
    ]),
  );
}

/** Attache leur note aux lignes du catalogue (cartes produit). */
export async function withRatings<T extends { id: string }>(
  rows: T[],
): Promise<(T & { rating: { average: number; count: number } | null })[]> {
  const ratings = await productRatings(rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, rating: ratings.get(row.id) ?? null }));
}

/** Moyenne des avis d'un produit, en SQL : tri « Mieux notés ». */
export const productRatingSql = sql`(
  SELECT avg(pr.rating) FROM product_reviews pr
   WHERE pr.product_id = ${products.id} AND pr.hidden_at IS NULL
)`;

/** Filtre « au moins N étoiles » sur la moyenne des avis visibles. */
export function ratedAtLeast(min: number) {
  return sql`${products.id} IN (
    SELECT pr.product_id FROM product_reviews pr
     WHERE pr.hidden_at IS NULL
     GROUP BY pr.product_id
    HAVING avg(pr.rating) >= ${min}
  )`;
}

export type ShopRating = {
  /** Moyenne générale : produits conformes + trois critères vendeur. */
  average: number;
  /** Nombre d'avis produits. */
  productCount: number;
  /** Nombre d'avis vendeur (un par commande). */
  sellerCount: number;
  products: RatingSummary;
  communication: number;
  shipping: number;
  packaging: number;
};

/** Notes d'une boutique : produits + critères de service. */
export async function shopRating(sellerId: string): Promise<ShopRating> {
  const [productRows, [criteria]] = await Promise.all([
    db
      .select({ rating: productReviews.rating, n: count() })
      .from(productReviews)
      .where(
        and(eq(productReviews.sellerId, sellerId), isNull(productReviews.hiddenAt)),
      )
      .groupBy(productReviews.rating),
    db
      .select({
        communication: avg(sellerReviews.communication),
        shipping: avg(sellerReviews.shipping),
        packaging: avg(sellerReviews.packaging),
        n: count(),
      })
      .from(sellerReviews)
      .where(
        and(eq(sellerReviews.sellerId, sellerId), isNull(sellerReviews.hiddenAt)),
      ),
  ]);

  const products = summarize(productRows);
  const communication = Number(criteria?.communication ?? 0);
  const shipping = Number(criteria?.shipping ?? 0);
  const packaging = Number(criteria?.packaging ?? 0);
  const sellerCount = criteria?.n ?? 0;

  const parts = [
    ...(products.count > 0 ? [products.average] : []),
    ...(sellerCount > 0 ? [communication, shipping, packaging] : []),
  ];
  return {
    average: parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0,
    productCount: products.count,
    sellerCount,
    products,
    communication,
    shipping,
    packaging,
  };
}

/** Avis d'un produit, les plus récents d'abord. */
export async function productReviewList(productId: string, limit = 20) {
  return db
    .select({
      review: productReviews,
      buyerName: users.fullName,
      orderedAt: orders.createdAt,
    })
    .from(productReviews)
    .innerJoin(users, eq(users.id, productReviews.buyerId))
    .innerJoin(orders, eq(orders.id, productReviews.orderId))
    .where(
      and(eq(productReviews.productId, productId), isNull(productReviews.hiddenAt)),
    )
    .orderBy(desc(productReviews.createdAt))
    .limit(limit);
}

/** Avis produits reçus par une boutique (tous produits confondus). */
export async function shopProductReviewList(sellerId: string, limit = 20) {
  return db
    .select({
      review: productReviews,
      buyerName: users.fullName,
      productTitle: products.title,
      orderedAt: orders.createdAt,
    })
    .from(productReviews)
    .innerJoin(users, eq(users.id, productReviews.buyerId))
    .innerJoin(products, eq(products.id, productReviews.productId))
    .innerJoin(orders, eq(orders.id, productReviews.orderId))
    .where(
      and(eq(productReviews.sellerId, sellerId), isNull(productReviews.hiddenAt)),
    )
    .orderBy(desc(productReviews.createdAt))
    .limit(limit);
}

/** Avis vendeur d'une boutique, les plus récents d'abord. */
export async function sellerReviewList(sellerId: string, limit = 20) {
  return db
    .select({ review: sellerReviews, buyerName: users.fullName })
    .from(sellerReviews)
    .innerJoin(users, eq(users.id, sellerReviews.buyerId))
    .where(and(eq(sellerReviews.sellerId, sellerId), isNull(sellerReviews.hiddenAt)))
    .orderBy(desc(sellerReviews.createdAt))
    .limit(limit);
}

/**
 * Commande livrée dont l'acheteur peut encore noter tout ou partie : ses
 * articles et l'avis vendeur éventuellement déjà donné.
 */
export async function reviewableOrder(orderId: string, buyerId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.buyerId, buyerId)))
    .limit(1)
    .catch(() => []);
  if (!order || order.status !== "delivered") return null;

  const [items, reviews, [seller]] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)),
    db
      .select()
      .from(productReviews)
      .where(eq(productReviews.orderId, orderId)),
    db.select().from(sellerReviews).where(eq(sellerReviews.orderId, orderId)).limit(1),
  ]);

  const reviewed = new Map(reviews.map((review) => [review.productId, review]));
  return {
    order,
    sellerReview: seller ?? null,
    items: items.map((item) => ({
      item,
      review: item.productId ? (reviewed.get(item.productId) ?? null) : null,
    })),
  };
}

/** Commandes livrées de l'acheteur encore à noter (au moins un article). */
export async function ordersAwaitingReview(buyerId: string, limit = 20) {
  return db
    .select({
      id: orders.id,
      number: orders.number,
      deliveredAt: orders.deliveredAt,
      items: sql<number>`count(distinct ${orderItems.productId})::int`,
      reviews: sql<number>`count(distinct ${productReviews.productId})::int`,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(productReviews, eq(productReviews.orderId, orders.id))
    .where(and(eq(orders.buyerId, buyerId), eq(orders.status, "delivered")))
    .groupBy(orders.id)
    .having(
      sql`count(distinct ${orderItems.productId}) > count(distinct ${productReviews.productId})`,
    )
    .orderBy(desc(orders.deliveredAt))
    .limit(limit);
}

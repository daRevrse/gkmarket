import "server-only";

import { and, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { disputes, orders } from "@/db/schema";

// Indicateurs de confiance d'une boutique (docs/CHANGEMENTS.md §5, lot 5) :
// tous calculés à partir des commandes et des messages - jamais déclarés par
// le vendeur. Sous le seuil d'activité, on affiche « Nouveau vendeur »
// plutôt que des pourcentages trompeurs.

/** Commandes livrées en dessous desquelles les taux ne sont pas affichés. */
export const NEW_SELLER_THRESHOLD = 5;

/** Expédition considérée « rapide » en dessous de ce délai après paiement. */
const FAST_SHIPPING_HOURS = 48;

const PAID_STATUSES = [
  "paid",
  "processing",
  "shipped",
  "delivered",
  "disputed",
  "refunded",
] as const;

export type ShopStats = {
  deliveredOrders: number;
  paidOrders: number;
  /** Part des commandes expédiées sous 48 h après paiement (null si inconnu). */
  fastShippingRate: number | null;
  /** Part des acheteurs revenus commander une seconde fois. */
  repeatRate: number | null;
  disputeRate: number | null;
  /** Part des conversations où le vendeur a répondu (90 derniers jours). */
  responseRate: number | null;
  /** Délai médian de première réponse, en heures. */
  responseHours: number | null;
  /** Vrai tant que la boutique n'a pas assez de commandes livrées. */
  isNew: boolean;
};

export async function shopStats(sellerId: string): Promise<ShopStats> {
  const [[volumes], [shipping], [repeat], [disputeRow], messages] =
    await Promise.all([
      db
        .select({
          delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
          paid: count(),
        })
        .from(orders)
        .where(
          and(
            eq(orders.sellerId, sellerId),
            inArray(orders.status, [...PAID_STATUSES]),
          ),
        ),
      db
        .select({
          shipped: sql<number>`count(*)::int`,
          onTime: sql<number>`count(*) filter (
            where ${orders.shippedAt} <= ${orders.paidAt} + interval '${sql.raw(String(FAST_SHIPPING_HOURS))} hours'
          )::int`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.sellerId, sellerId),
            sql`${orders.paidAt} is not null and ${orders.shippedAt} is not null`,
          ),
        ),
      db
        .select({
          buyers: sql<number>`count(*)::int`,
          returning: sql<number>`count(*) filter (where n > 1)::int`,
        })
        .from(
          db
            .select({
              buyerId: orders.buyerId,
              n: sql<number>`count(*)`.as("n"),
            })
            .from(orders)
            .where(
              and(eq(orders.sellerId, sellerId), eq(orders.status, "delivered")),
            )
            .groupBy(orders.buyerId)
            .as("par_acheteur"),
        ),
      db
        .select({ n: count() })
        .from(disputes)
        .innerJoin(orders, eq(orders.id, disputes.orderId))
        .where(eq(orders.sellerId, sellerId)),
      db.execute<{
        asked: number;
        answered: number;
        median_seconds: number | null;
      }>(sql`
        WITH premiers AS (
          SELECT c.id,
                 min(m.created_at) FILTER (WHERE m.sender_id = c.buyer_id) AS premier_acheteur,
                 min(m.created_at) FILTER (WHERE m.sender_id <> c.buyer_id) AS premier_vendeur
            FROM conversations c
            JOIN conversation_messages m ON m.conversation_id = c.id
           WHERE c.seller_id = ${sellerId}
             AND m.created_at > now() - interval '90 days'
           GROUP BY c.id
        )
        SELECT count(*) FILTER (WHERE premier_acheteur IS NOT NULL)::int AS asked,
               count(*) FILTER (WHERE premier_vendeur > premier_acheteur)::int AS answered,
               percentile_cont(0.5) WITHIN GROUP (
                 ORDER BY extract(epoch FROM (premier_vendeur - premier_acheteur))
               ) FILTER (WHERE premier_vendeur > premier_acheteur) AS median_seconds
          FROM premiers
      `),
    ]);

  const delivered = volumes?.delivered ?? 0;
  const paid = volumes?.paid ?? 0;
  const conversation = messages?.rows?.[0];
  const asked = Number(conversation?.asked ?? 0);
  const answered = Number(conversation?.answered ?? 0);
  const medianSeconds = conversation?.median_seconds;

  return {
    deliveredOrders: delivered,
    paidOrders: paid,
    fastShippingRate:
      shipping && shipping.shipped > 0 ? shipping.onTime / shipping.shipped : null,
    repeatRate: repeat && repeat.buyers > 0 ? repeat.returning / repeat.buyers : null,
    disputeRate: paid > 0 ? (disputeRow?.n ?? 0) / paid : null,
    responseRate: asked > 0 ? answered / asked : null,
    responseHours:
      medianSeconds != null ? Math.round((Number(medianSeconds) / 3600) * 10) / 10 : null,
    isNew: delivered < NEW_SELLER_THRESHOLD,
  };
}

/** Pourcentage arrondi, ou tiret si l'indicateur n'est pas disponible. */
export function formatRate(rate: number | null): string {
  return rate === null ? "-" : `${Math.round(rate * 100)} %`;
}

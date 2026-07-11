import { and, desc, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { orders, sellerProfiles, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";
import { OrderAdminActions } from "./order-admin-actions";

const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "disputed",
  "refunded",
] as const;

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;

  const filters: SQL[] = [];
  if (params.q?.trim()) {
    filters.push(ilike(orders.number, `%${params.q.trim()}%`));
  }
  if (
    params.statut &&
    (ORDER_STATUSES as readonly string[]).includes(params.statut)
  ) {
    filters.push(eq(orders.status, params.statut as (typeof ORDER_STATUSES)[number]));
  }

  const rows = await db
    .select({
      order: orders,
      buyerName: users.fullName,
      shopName: sellerProfiles.shopName,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.buyerId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, orders.sellerId))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(100);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Commandes</h1>
        <p className="mt-1 text-ink-muted">
          Toutes les commandes de la plateforme. L&apos;annulation rembourse
          intégralement l&apos;acheteur et restitue le stock.
        </p>
      </div>

      <form action="/admin/commandes" className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="N° de commande (DL-…)"
          className="w-64 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none"
        />
        <select
          name="statut"
          defaultValue={params.statut ?? ""}
          className="rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {orderStatusLabels[status]?.label ?? status}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-gold-light"
        >
          Filtrer
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-ink-muted">Aucune commande trouvée.</p>
        ) : (
          rows.map(({ order, buyerName, shopName }) => {
            const status = orderStatusLabels[order.status] ?? {
              label: order.status,
            };
            return (
              <Card key={order.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-bold">{order.number}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {buyerName ?? "Acheteur"} chez {shopName} ·{" "}
                      {order.createdAt.toLocaleDateString("fr-FR")} · livraison{" "}
                      {order.shippingCity}
                      {order.commissionFcfa
                        ? ` · commission ${formatFcfa(order.commissionFcfa)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display font-bold text-gold">
                      {formatFcfa(order.totalFcfa)}
                    </span>
                    <OrderAdminActions
                      orderId={order.id}
                      status={order.status}
                      paid={order.paidAt !== null}
                    />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}

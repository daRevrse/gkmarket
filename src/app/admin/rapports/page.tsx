import { and, count, desc, eq, inArray, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  disputes,
  orderItems,
  orders,
  sellerProfiles,
  users,
} from "@/db/schema";
import { Card } from "@/components/ui/card";
import { disputeReasonLabels, disputeStatusLabels } from "@/lib/disputes";
import { formatFcfa } from "@/lib/format";

const PAID_STATUSES = ["paid", "processing", "shipped", "delivered", "disputed"] as const;

const monthOf = (column: unknown) =>
  sql<string>`to_char(date_trunc('month', ${column}), 'YYYY-MM')`;

function monthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
}

/** Barre horizontale proportionnelle (rapports sans librairie de graphes). */
function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <span
        className="block h-full rounded-full bg-gold/80"
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

export default async function AdminRapportsPage() {
  const [salesByMonth, signupsByMonth, topSellers, topProducts, disputesByStatus, disputesByReason, [paidTotal], [disputesTotal]] =
    await Promise.all([
      // Ventes + commissions par mois (MVP n°278, 282)
      db
        .select({
          month: monthOf(orders.createdAt).as("month"),
          n: count(),
          gmv: sum(orders.totalFcfa),
          commission: sum(orders.commissionFcfa),
        })
        .from(orders)
        .where(inArray(orders.status, [...PAID_STATUSES]))
        .groupBy(sql`month`)
        .orderBy(desc(sql`month`))
        .limit(6),
      // Inscriptions par mois (MVP n°279)
      db
        .select({ month: monthOf(users.createdAt).as("month"), n: count() })
        .from(users)
        .groupBy(sql`month`)
        .orderBy(desc(sql`month`))
        .limit(6),
      // Top boutiques par volume encaissé (MVP n°280)
      db
        .select({
          shopName: sellerProfiles.shopName,
          n: count(),
          gmv: sum(orders.subtotalFcfa),
        })
        .from(orders)
        .innerJoin(sellerProfiles, eq(sellerProfiles.id, orders.sellerId))
        .where(inArray(orders.status, [...PAID_STATUSES]))
        .groupBy(sellerProfiles.id, sellerProfiles.shopName)
        .orderBy(desc(sum(orders.subtotalFcfa)))
        .limit(5),
      // Top produits vendus (MVP n°281)
      db
        .select({
          title: orderItems.title,
          qty: sum(orderItems.quantity),
          total: sum(orderItems.totalFcfa),
        })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(inArray(orders.status, [...PAID_STATUSES]))
        .groupBy(orderItems.title)
        .orderBy(desc(sum(orderItems.quantity)))
        .limit(5),
      // Litiges (MVP n°283)
      db
        .select({ status: disputes.status, n: count() })
        .from(disputes)
        .groupBy(disputes.status)
        .orderBy(desc(count())),
      db
        .select({ reason: disputes.reason, n: count() })
        .from(disputes)
        .groupBy(disputes.reason)
        .orderBy(desc(count())),
      db
        .select({
          n: count(),
          commission: sum(orders.commissionFcfa),
        })
        .from(orders)
        .where(
          and(
            inArray(orders.status, [...PAID_STATUSES]),
            isNotNull(orders.commissionFcfa),
          ),
        ),
      db.select({ n: count() }).from(disputes),
    ]);

  const maxGmv = Math.max(...salesByMonth.map((r) => Number(r.gmv ?? 0)), 0);
  const maxSignups = Math.max(...signupsByMonth.map((r) => r.n), 0);
  const maxSellerGmv = Math.max(...topSellers.map((r) => Number(r.gmv ?? 0)), 0);

  const [paidOrdersCount] = await db
    .select({ n: count() })
    .from(orders)
    .where(inArray(orders.status, [...PAID_STATUSES]));
  const disputeRate =
    paidOrdersCount.n > 0
      ? Math.round((disputesTotal.n / paidOrdersCount.n) * 100)
      : 0;

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Rapports</h1>
        <p className="mt-1 text-ink-muted">
          Ventes, inscriptions, boutiques, produits, commissions et litiges -
          calculés en direct sur les données de la plateforme.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ventes par mois */}
        <Card>
          <h2 className="font-display text-lg font-bold">Ventes par mois</h2>
          {salesByMonth.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Aucune vente encaissée.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {salesByMonth.map((row) => (
                <li key={row.month} className="text-sm">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="capitalize">{monthLabel(row.month)}</span>
                    <span className="text-ink-muted">
                      {row.n} cde{row.n > 1 ? "s" : ""} ·{" "}
                      <span className="font-display font-bold text-gold">
                        {formatFcfa(Number(row.gmv ?? 0))}
                      </span>
                    </span>
                  </div>
                  <Bar value={Number(row.gmv ?? 0)} max={maxGmv} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Inscriptions par mois */}
        <Card>
          <h2 className="font-display text-lg font-bold">
            Nouveaux utilisateurs par mois
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {signupsByMonth.map((row) => (
              <li key={row.month} className="text-sm">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="capitalize">{monthLabel(row.month)}</span>
                  <span className="font-display font-bold">{row.n}</span>
                </div>
                <Bar value={row.n} max={maxSignups} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Top boutiques */}
        <Card>
          <h2 className="font-display text-lg font-bold">
            Boutiques les plus actives
          </h2>
          {topSellers.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Aucune vente encaissée.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {topSellers.map((row, i) => (
                <li key={row.shopName} className="text-sm">
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">
                      <span className="font-display font-bold text-gold">
                        {i + 1}.
                      </span>{" "}
                      {row.shopName}
                    </span>
                    <span className="shrink-0 text-ink-muted">
                      {row.n} cde{row.n > 1 ? "s" : ""} ·{" "}
                      <span className="text-ink">
                        {formatFcfa(Number(row.gmv ?? 0))}
                      </span>
                    </span>
                  </div>
                  <Bar value={Number(row.gmv ?? 0)} max={maxSellerGmv} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Top produits */}
        <Card>
          <h2 className="font-display text-lg font-bold">Produits les plus vendus</h2>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Aucune vente encaissée.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2.5">
              {topProducts.map((row, i) => (
                <li
                  key={row.title}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-display font-bold text-gold">
                      {i + 1}.
                    </span>{" "}
                    {row.title}
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {Number(row.qty)} vendus ·{" "}
                    <span className="text-ink">
                      {formatFcfa(Number(row.total ?? 0))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Commissions */}
        <Card>
          <h2 className="font-display text-lg font-bold">Commissions</h2>
          <p className="mt-3 font-display text-2xl font-extrabold text-gold">
            {formatFcfa(Number(paidTotal.commission ?? 0))}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            perçues sur {paidTotal.n} commande{paidTotal.n > 1 ? "s" : ""}{" "}
            finalisée{paidTotal.n > 1 ? "s" : ""} (prélevées au versement
            vendeur).
          </p>
          <ul className="mt-4 flex flex-col gap-1.5 text-sm">
            {salesByMonth.map((row) => (
              <li
                key={row.month}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="capitalize text-ink-muted">
                  {monthLabel(row.month)}
                </span>
                <span>{formatFcfa(Number(row.commission ?? 0))}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Litiges */}
        <Card>
          <h2 className="font-display text-lg font-bold">Litiges</h2>
          <p className="mt-3 text-sm text-ink-muted">
            {disputesTotal.n} litige{disputesTotal.n > 1 ? "s" : ""} au total ·
            taux de {disputeRate} % des commandes payées.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="font-label text-xs font-semibold tracking-wider text-ink-muted uppercase">
                Par statut
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {disputesByStatus.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-ink-muted">
                      {disputeStatusLabels[row.status]?.label ?? row.status}
                    </span>
                    <span className="font-display font-bold">{row.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-label text-xs font-semibold tracking-wider text-ink-muted uppercase">
                Par motif
              </p>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {disputesByReason.map((row) => (
                  <li
                    key={row.reason}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-ink-muted">
                      {disputeReasonLabels[row.reason] ?? row.reason}
                    </span>
                    <span className="font-display font-bold">{row.n}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

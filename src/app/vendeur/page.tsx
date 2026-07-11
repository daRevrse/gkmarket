import Link from "next/link";
import { and, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  orderItems,
  orders,
  products,
  walletTransactions,
  wallets,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { requireApprovedSeller } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";

// Statuts où la vente est engagée (payée ou plus loin).
const SALE_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

export default async function VendeurDashboardPage() {
  const user = await requireApprovedSeller();
  const sellerId = user.sellerProfile.id;

  const [
    [published],
    [toProcess],
    [inProgress],
    [delivered],
    ordersByStatus,
    topProducts,
    lastPayouts,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(products)
      .where(
        and(eq(products.sellerId, sellerId), eq(products.status, "published")),
      ),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.sellerId, sellerId), eq(orders.status, "paid"))),
    db
      .select({ n: count() })
      .from(orders)
      .where(
        and(
          eq(orders.sellerId, sellerId),
          inArray(orders.status, ["processing", "shipped"]),
        ),
      ),
    db
      .select({
        n: count(),
        net: sum(
          sql`${orders.subtotalFcfa} - COALESCE(${orders.commissionFcfa}, 0)`,
        ),
      })
      .from(orders)
      .where(
        and(eq(orders.sellerId, sellerId), eq(orders.status, "delivered")),
      ),
    db
      .select({ status: orders.status, n: count() })
      .from(orders)
      .where(eq(orders.sellerId, sellerId))
      .groupBy(orders.status)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        title: orderItems.title,
        qty: sum(orderItems.quantity),
        total: sum(orderItems.totalFcfa),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orders.sellerId, sellerId),
          inArray(orders.status, [...SALE_STATUSES]),
        ),
      )
      .groupBy(orderItems.title)
      .orderBy(desc(sum(orderItems.quantity)))
      .limit(5),
    db
      .select({ tx: walletTransactions })
      .from(walletTransactions)
      .innerJoin(wallets, eq(wallets.id, walletTransactions.walletId))
      .where(
        and(
          eq(wallets.userId, user.id),
          eq(walletTransactions.type, "sale_income"),
        ),
      )
      .orderBy(desc(walletTransactions.createdAt))
      .limit(5),
  ]);

  const kpis = [
    {
      label: "Produits en ligne",
      value: String(published.n),
      href: "/vendeur/produits",
      iconBg: "bg-emerald/10 text-emerald",
      icon: "bag",
    },
    {
      label: "Commandes à accepter",
      value: String(toProcess.n),
      href: "/vendeur/commandes",
      iconBg: "bg-gold/10 text-gold",
      icon: "bell",
    },
    {
      label: "En préparation / expédiées",
      value: String(inProgress.n),
      href: "/vendeur/commandes",
      iconBg: "bg-white/5 text-ink-muted",
      icon: "package",
    },
    {
      label: "CA net versé (livrées)",
      value: formatFcfa(Number(delivered.net ?? 0)),
      href: "/compte/wallet",
      iconBg: "bg-gold/10 text-gold",
      icon: "wallet",
      accent: "text-gold",
    },
  ];

  return (
    <main className="w-full flex-1">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-label text-xs font-semibold tracking-widest text-ink-muted uppercase">
            Espace vendeur
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">
            {user.sellerProfile.shopName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton
            href={`/boutique/${sellerId}`}
            target="_blank"
            rel="noreferrer"
            size="sm"
            variant="ghost"
          >
            Voir ma boutique
          </LinkButton>
          <LinkButton href="/vendeur/produits/nouveau" size="sm">
            + Nouveau produit
          </LinkButton>
        </div>
      </div>

      {/* Chiffres clés (MVP n°20) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="fade-up group"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="glass h-full rounded-xl p-5 transition-colors group-hover:border-gold/40">
              <span
                className={`flex size-9 items-center justify-center rounded-md ${kpi.iconBg}`}
              >
                <Icon name={kpi.icon} className="size-4.5" />
              </span>
              <p
                className={`mt-4 font-display text-2xl font-extrabold ${kpi.accent ?? ""}`}
              >
                {kpi.value}
              </p>
              <p className="mt-1 font-label text-xs font-semibold tracking-wider text-ink-muted uppercase">
                {kpi.label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Statistiques de ventes (MVP n°21) */}
        <Card>
          <h2 className="font-display text-lg font-bold">Commandes par statut</h2>
          {ordersByStatus.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Aucune commande reçue pour le moment.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {ordersByStatus.map((row) => {
                const status = orderStatusLabels[row.status] ?? {
                  label: row.status,
                };
                return (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <span className="font-display font-bold">{row.n}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/vendeur/commandes"
            className="mt-4 inline-block font-label text-sm text-emerald hover:underline"
          >
            Toutes mes commandes ›
          </Link>
        </Card>

        {/* Meilleures ventes (MVP n°21) */}
        <Card>
          <h2 className="font-display text-lg font-bold">Meilleures ventes</h2>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Vos ventes apparaîtront ici.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
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
                    {Number(row.qty)} vendu{Number(row.qty) > 1 ? "s" : ""} ·{" "}
                    <span className="text-ink">
                      {formatFcfa(Number(row.total ?? 0))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Historique des versements (MVP n°25) */}
      <Card className="mt-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-lg font-bold">Derniers versements</h2>
          <Link
            href="/compte/wallet"
            className="font-label text-sm text-emerald hover:underline"
          >
            Tout l&apos;historique ›
          </Link>
        </div>
        {lastPayouts.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Les fonds sont versés sur votre wallet à la confirmation de
            réception par l&apos;acheteur.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-white/[0.04]">
            {lastPayouts.map(({ tx }) => (
              <li
                key={tx.id}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-ink-muted">
                  {tx.createdAt.toLocaleDateString("fr-FR")} · {tx.description}
                </span>
                <span className="shrink-0 font-display font-bold text-emerald">
                  +{formatFcfa(tx.amountFcfa)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}

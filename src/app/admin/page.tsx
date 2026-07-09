import Link from "next/link";
import { count, eq, inArray, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  disputes,
  orders,
  products,
  sellerProfiles,
  users,
  wallets,
} from "@/db/schema";
import { Card, CardSection } from "@/components/ui/card";
import { autoReleaseOverdueEscrows } from "@/lib/escrow";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";

// Statuts où l'argent de l'acheteur est encaissé (GMV) ; l'Escrow ne retient
// que les commandes pas encore finalisées.
const PAID_STATUSES = ["paid", "processing", "shipped", "delivered", "disputed"] as const;
const ESCROW_STATUSES = ["paid", "processing", "shipped", "disputed"] as const;

export default async function AdminDashboardPage() {
  // Filet de sécurité local : en production, Vercel Cron appelle
  // /api/cron/escrow quotidiennement ; ici on libère aussi à l'ouverture
  // du dashboard (idempotent, verrouillé par le statut des commandes).
  await autoReleaseOverdueEscrows();

  const [
    [activeUsers],
    [paidOrders],
    [escrow],
    [commissions],
    [walletLiability],
    [pendingSellers],
    [pendingCouriers],
    [openDisputes],
    [publishedProducts],
    ordersByStatus,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(users)
      .where(eq(users.status, "active")),
    db
      .select({ value: count(), gmv: sum(orders.totalFcfa) })
      .from(orders)
      .where(inArray(orders.status, [...PAID_STATUSES])),
    db
      .select({ value: sum(orders.totalFcfa) })
      .from(orders)
      .where(inArray(orders.status, [...ESCROW_STATUSES])),
    db
      .select({ value: sum(orders.commissionFcfa) })
      .from(orders)
      .where(isNotNull(orders.commissionFcfa)),
    db.select({ value: sum(wallets.balanceFcfa) }).from(wallets),
    db
      .select({ value: count() })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.status, "pending")),
    db
      .select({ value: count() })
      .from(courierProfiles)
      .where(eq(courierProfiles.status, "pending")),
    db
      .select({ value: count() })
      .from(disputes)
      .where(eq(disputes.status, "open")),
    db
      .select({ value: count() })
      .from(products)
      .where(eq(products.status, "published")),
    db
      .select({ status: orders.status, total: count() })
      .from(orders)
      .groupBy(orders.status)
      .orderBy(sql`count(*) DESC`),
  ]);

  const gmv = Number(paidOrders.gmv ?? 0);
  const aov = paidOrders.value > 0 ? Math.round(gmv / paidOrders.value) : 0;
  const [{ value: disputesTotal }] = await db
    .select({ value: count() })
    .from(disputes);
  const disputeRate =
    paidOrders.value > 0
      ? Math.round((disputesTotal / paidOrders.value) * 100)
      : 0;

  const tasks = [
    {
      count: pendingSellers.value,
      label: "demande(s) vendeur à valider",
      href: "/admin/vendeurs",
    },
    {
      count: pendingCouriers.value,
      label: "demande(s) livreur à valider",
      href: "/admin/livreurs",
    },
    {
      count: openDisputes.value,
      label: "litige(s) à arbitrer",
      href: "/admin/litiges",
    },
  ].filter((task) => task.count > 0);

  const kpis = [
    { label: "Utilisateurs actifs", value: String(activeUsers.value) },
    { label: "Commandes payées", value: String(paidOrders.value) },
    { label: "GMV (volume d'affaires)", value: formatFcfa(gmv) },
    { label: "Panier moyen (AOV)", value: formatFcfa(aov) },
    { label: "Commissions perçues", value: formatFcfa(Number(commissions.value ?? 0)) },
    { label: "Fonds sécurisés", value: formatFcfa(Number(escrow.value ?? 0)) },
    {
      label: "Soldes wallets (passif)",
      value: formatFcfa(Number(walletLiability.value ?? 0)),
    },
    { label: "Taux de litiges", value: `${disputeRate} %` },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">
          Vue d&apos;ensemble
        </h1>
        <p className="mt-1 text-ink-muted">
          {publishedProducts.value} produit
          {publishedProducts.value > 1 ? "s" : ""} en ligne ·{" "}
          {paidOrders.value} commande{paidOrders.value > 1 ? "s" : ""} payée
          {paidOrders.value > 1 ? "s" : ""} à ce jour.
        </p>
      </div>

      {tasks.length > 0 ? (
        <Card className="mb-6 border-gold/30">
          <h2 className="font-display text-lg font-bold">Tâches en attente</h2>
          <div className="mt-3 flex flex-col gap-2">
            {tasks.map((task) => (
              <Link key={task.href} href={task.href} className="group">
                <CardSection className="flex items-center justify-between p-3 transition-colors group-hover:bg-white/[0.06]">
                  <span className="text-sm">
                    <span className="font-display font-bold text-gold">
                      {task.count}
                    </span>{" "}
                    {task.label}
                  </span>
                  <span className="text-sm text-emerald">Traiter ›</span>
                </CardSection>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs text-ink-muted">{kpi.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-gold">
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold">Commandes par statut</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {ordersByStatus.map((row) => (
            <CardSection key={row.status} className="px-4 py-2 text-sm">
              <span className="font-display font-bold">{row.total}</span>{" "}
              <span className="text-ink-muted">
                {orderStatusLabels[row.status]?.label ?? row.status}
              </span>
            </CardSection>
          ))}
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Détail complet dans{" "}
          <Link href="/admin/commandes" className="text-emerald hover:underline">
            Commandes
          </Link>{" "}
          et{" "}
          <Link href="/admin/financier" className="text-emerald hover:underline">
            Financier
          </Link>
          .
        </p>
      </Card>
    </main>
  );
}

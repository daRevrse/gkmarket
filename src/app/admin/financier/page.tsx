import { desc, eq, inArray, isNotNull, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { orders, users, wallets, walletTransactions } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { ESCROW_AUTO_RELEASE_DAYS } from "@/lib/escrow";
import { formatFcfa } from "@/lib/format";
import { EscrowReleaseButton } from "./escrow-release-button";

const txTypeLabels: Record<string, string> = {
  recharge: "Recharge",
  withdrawal: "Retrait",
  order_payment: "Paiement commande",
  order_refund: "Remboursement",
  sale_income: "Versement vendeur",
  delivery_income: "Versement livreur",
};

export default async function AdminFinancierPage() {
  const [
    [escrow],
    [commissions],
    [refunds],
    [recharges],
    [walletLiability],
    [pendingWithdrawals],
    transactions,
  ] = await Promise.all([
    db
      .select({ value: sum(orders.totalFcfa), nb: sql<number>`count(*)::int` })
      .from(orders)
      .where(inArray(orders.status, ["paid", "processing", "shipped", "disputed"])),
    db
      .select({ value: sum(orders.commissionFcfa) })
      .from(orders)
      .where(isNotNull(orders.commissionFcfa)),
    db
      .select({ value: sum(walletTransactions.amountFcfa) })
      .from(walletTransactions)
      .where(eq(walletTransactions.type, "order_refund")),
    db
      .select({ value: sum(walletTransactions.amountFcfa) })
      .from(walletTransactions)
      .where(eq(walletTransactions.type, "recharge")),
    db.select({ value: sum(wallets.balanceFcfa) }).from(wallets),
    db
      .select({ value: sum(walletTransactions.amountFcfa) })
      .from(walletTransactions)
      .where(eq(walletTransactions.type, "withdrawal")),
    db
      .select({
        tx: walletTransactions,
        ownerName: users.fullName,
      })
      .from(walletTransactions)
      .innerJoin(wallets, eq(wallets.id, walletTransactions.walletId))
      .innerJoin(users, eq(users.id, wallets.userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(30),
  ]);

  const kpis = [
    {
      label: `Fonds en Escrow (${escrow.nb} commande${escrow.nb > 1 ? "s" : ""})`,
      value: formatFcfa(Number(escrow.value ?? 0)),
    },
    {
      label: "Commissions perçues",
      value: formatFcfa(Number(commissions.value ?? 0)),
    },
    {
      label: "Remboursements émis",
      value: formatFcfa(Number(refunds.value ?? 0)),
    },
    {
      label: "Recharges cumulées",
      value: formatFcfa(Number(recharges.value ?? 0)),
    },
    {
      label: "Retraits cumulés",
      value: formatFcfa(Math.abs(Number(pendingWithdrawals.value ?? 0))),
    },
    {
      label: "Soldes wallets (passif plateforme)",
      value: formatFcfa(Number(walletLiability.value ?? 0)),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Financier</h1>
        <p className="mt-1 text-ink-muted">
          Trésorerie de la plateforme : Escrow, commissions et grand livre
          des wallets. Les commandes expédiées sans confirmation ni litige
          sont libérées après {ESCROW_AUTO_RELEASE_DAYS} jours (cron
          quotidien en production).
        </p>
        <div className="mt-3">
          <EscrowReleaseButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <p className="text-xs text-ink-muted">{kpi.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-gold">
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-0">
        <h2 className="px-5 pt-5 font-display text-lg font-bold">
          Derniers mouvements ({transactions.length})
        </h2>
        <div className="mt-3 flex flex-col divide-y divide-white/[0.04]">
          {transactions.map(({ tx, ownerName }) => (
            <div
              key={tx.id}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {txTypeLabels[tx.type] ?? tx.type}
                  <span className="text-ink-muted"> · {ownerName ?? "—"}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-muted">
                  {tx.description} · {tx.createdAt.toLocaleString("fr-FR")}
                </p>
              </div>
              <span
                className={
                  tx.amountFcfa >= 0
                    ? "font-display font-bold text-emerald"
                    : "font-display font-bold text-danger"
                }
              >
                {tx.amountFcfa >= 0 ? "+" : ""}
                {formatFcfa(tx.amountFcfa)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </main>
  );
}

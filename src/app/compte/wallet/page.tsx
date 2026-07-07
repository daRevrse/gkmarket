import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { walletTransactions } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { getOrCreateWallet } from "@/lib/wallet";
import { RechargeForm, WithdrawForm } from "./wallet-forms";

const typeLabels: Record<string, string> = {
  recharge: "Recharge",
  withdrawal: "Retrait",
  order_payment: "Paiement commande",
  order_refund: "Remboursement",
  sale_income: "Gain de vente",
};

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const wallet = await getOrCreateWallet(user.id);
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(50);

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mon compte
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Mon wallet
        </h1>
      </div>

      <Card glow className="text-center">
        <p className="text-sm text-ink-muted">Solde disponible</p>
        <p className="mt-1 font-display text-4xl font-extrabold text-gold">
          {formatFcfa(wallet.balanceFcfa)}
        </p>
      </Card>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-display text-lg font-bold">
            Recharger mon wallet
          </h2>
          <RechargeForm />
        </Card>
        <Card>
          <h2 className="mb-4 font-display text-lg font-bold">
            Retirer vers Mobile Money
          </h2>
          <WithdrawForm />
        </Card>
      </div>

      <Card className="mt-6 p-0">
        <h2 className="border-b border-white/[0.06] px-5 py-4 font-display text-lg font-bold">
          Historique des transactions
        </h2>
        {transactions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted">
            Aucune transaction pour le moment.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {typeLabels[transaction.type] ?? transaction.type}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {transaction.description} ·{" "}
                    {transaction.createdAt.toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={
                    transaction.amountFcfa >= 0
                      ? "shrink-0 font-display font-bold text-emerald"
                      : "shrink-0 font-display font-bold text-danger"
                  }
                >
                  {transaction.amountFcfa >= 0 ? "+" : "−"}
                  {formatFcfa(Math.abs(transaction.amountFcfa))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}

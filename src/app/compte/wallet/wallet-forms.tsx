"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { rechargeWallet, withdrawFromWallet } from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatFcfa, formatPct } from "@/lib/format";
import { feeFromPct } from "@/lib/orders";

const OPERATORS = ["Flooz", "Tmoney", "MTN MoMo", "Moov Money"];

export function RechargeForm({
  mobileMoneyFeePct,
}: {
  /** Frais de l'agrégateur répercutés à l'acheteur, en %. */
  mobileMoneyFeePct: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState(OPERATORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setLoading(true);
    const result = await rechargeWallet(Number(amount), operator);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    setAmount("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />
      {done ? (
        <p className="rounded-md border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-emerald-light">
          Recharge effectuée ✓
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Montant (FCFA)" htmlFor="rechargeAmount">
          <Input
            id="rechargeAmount"
            type="number"
            min={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="50000"
            required
            className="w-40"
          />
        </FormField>
        <FormField label="Opérateur" htmlFor="operator">
          <select
            id="operator"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="rounded-md border border-white/10 bg-navy-deep px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
        </FormField>
        <Button type="submit" disabled={loading}>
          {loading ? "Recharge…" : "Recharger"}
        </Button>
      </div>
      {mobileMoneyFeePct > 0 && Number(amount) > 0 ? (
        <p className="text-sm text-ink-muted">
          Frais Mobile Money ({formatPct(mobileMoneyFeePct)}) :{" "}
          {formatFcfa(feeFromPct(Number(amount), mobileMoneyFeePct))} - montant
          débité de votre compte :{" "}
          <span className="text-ink">
            {formatFcfa(
              Number(amount) + feeFromPct(Number(amount), mobileMoneyFeePct),
            )}
          </span>
        </p>
      ) : null}
      <p className="text-xs text-ink-muted">
        Mode développement : la recharge est simulée, aucun vrai paiement.
      </p>
    </form>
  );
}

export function WithdrawForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(false);
    setLoading(true);
    const result = await withdrawFromWallet(Number(amount), phone);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    setAmount("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />
      {done ? (
        <p className="rounded-md border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-emerald-light">
          Retrait effectué ✓
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Montant (FCFA)" htmlFor="withdrawAmount">
          <Input
            id="withdrawAmount"
            type="number"
            min={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25000"
            required
            className="w-40"
          />
        </FormField>
        <FormField label="Numéro Mobile Money" htmlFor="withdrawPhone">
          <Input
            id="withdrawPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+228 90 12 34 56"
            required
            className="w-48"
          />
        </FormField>
        <Button type="submit" variant="secondary" disabled={loading}>
          {loading ? "Retrait…" : "Retirer"}
        </Button>
      </div>
    </form>
  );
}

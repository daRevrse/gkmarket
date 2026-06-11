"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelOrder, confirmDelivery, payOrder } from "../actions";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    setLoading(true);
    const result = await action();
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setConfirmCancel(false);
      router.refresh();
    }
  }

  const cancellable = status === "pending_payment" || status === "paid";

  return (
    <div className="flex flex-col gap-3">
      <FormError message={error} />
      {error?.includes("Solde insuffisant") ? (
        <Link
          href="/compte/wallet"
          className="text-sm text-emerald hover:underline"
        >
          Recharger mon wallet →
        </Link>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {status === "pending_payment" ? (
          <Button disabled={loading} onClick={() => run(() => payOrder(orderId))}>
            {loading ? "Paiement…" : "Payer avec mon wallet"}
          </Button>
        ) : null}

        {status === "shipped" ? (
          <Button
            disabled={loading}
            onClick={() => run(() => confirmDelivery(orderId))}
          >
            {loading ? "Confirmation…" : "J'ai bien reçu ma commande"}
          </Button>
        ) : null}

        {cancellable ? (
          confirmCancel ? (
            <>
              <Button
                variant="danger"
                disabled={loading}
                onClick={() => run(() => cancelOrder(orderId))}
              >
                Confirmer l&apos;annulation
              </Button>
              <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
                Garder ma commande
              </Button>
            </>
          ) : (
            <Button
              variant="danger"
              disabled={loading}
              onClick={() => setConfirmCancel(true)}
            >
              Annuler la commande
            </Button>
          )
        ) : null}
      </div>

      {status === "shipped" ? (
        <p className="text-xs text-ink-muted">
          En confirmant la réception, les fonds bloqués en Escrow sont versés
          au vendeur.
        </p>
      ) : null}
    </div>
  );
}

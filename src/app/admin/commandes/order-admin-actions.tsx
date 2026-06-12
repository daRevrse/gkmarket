"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminCancelOrder } from "./actions";
import { Button } from "@/components/ui/button";

export function OrderAdminActions({
  orderId,
  status,
  paid,
}: {
  orderId: string;
  status: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!["pending_payment", "paid", "processing", "shipped"].includes(status)) {
    return null;
  }

  async function run() {
    setError(null);
    setLoading(true);
    const result = await adminCancelOrder(orderId);
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setConfirming(false);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {confirming ? (
        <div className="flex gap-2">
          <Button size="sm" variant="danger" disabled={loading} onClick={run}>
            {paid ? "Annuler + rembourser" : "Confirmer l'annulation"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            Garder
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="danger"
          disabled={loading}
          onClick={() => setConfirming(true)}
        >
          Annuler la commande
        </Button>
      )}
    </div>
  );
}

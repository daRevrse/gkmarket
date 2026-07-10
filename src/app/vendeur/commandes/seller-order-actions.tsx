"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder, refuseOrder } from "./actions";
import { Button, LinkButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SellerOrderActions({
  orderId,
  status,
  deliveryStatus,
}: {
  orderId: string;
  status: string;
  deliveryStatus: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<null | "refuse" | "ship">(null);
  const [reason, setReason] = useState("");
  const [tracking, setTracking] = useState("");
  const [eta, setEta] = useState("");

  if (status !== "paid" && status !== "processing") return null;

  // Course en cours : c'est le livreur qui fait avancer la livraison.
  const hasActiveDelivery =
    deliveryStatus !== null &&
    deliveryStatus !== "refused" &&
    deliveryStatus !== "cancelled";
  const pickedUp = deliveryStatus === "picked_up";

  async function accept() {
    setError(null);
    setLoading(true);
    const result = await advanceOrder(orderId, "processing");
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function ship() {
    setError(null);
    setLoading(true);
    const result = await advanceOrder(orderId, "shipped", {
      trackingNumber: tracking,
      estimatedDeliveryAt: eta || null,
    });
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  async function refuse() {
    if (!reason.trim()) {
      setError("Indiquez le motif du refus.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await refuseOrder(orderId, reason);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.06] pt-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {mode === "refuse" ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm text-ink-muted" htmlFor={`reason-${orderId}`}>
            Motif du refus (communiqué à l&apos;acheteur, qui sera remboursé)
          </label>
          <textarea
            id={`reason-${orderId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-danger focus:outline-none"
            placeholder="Rupture de stock, adresse hors zone…"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button size="sm" variant="danger" loading={loading} onClick={refuse}>
              Confirmer le refus
            </Button>
          </div>
        </div>
      ) : mode === "ship" ? (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              N° de suivi (optionnel)
              <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Ex. DL-TRACK-00123" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Livraison estimée (optionnel)
              <input
                type="date"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" disabled={loading} onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button size="sm" loading={loading} onClick={ship}>
              Confirmer l&apos;expédition
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {status === "paid" ? (
            <Button size="sm" loading={loading} onClick={accept}>
              Accepter et préparer
            </Button>
          ) : null}

          {!pickedUp ? (
            <Button size="sm" variant="danger" disabled={loading} onClick={() => setMode("refuse")}>
              Refuser
            </Button>
          ) : null}

          {!hasActiveDelivery ? (
            <>
              <LinkButton
                size="sm"
                variant="secondary"
                href={`/vendeur/commandes/${orderId}/livreur`}
              >
                {deliveryStatus === "refused"
                  ? "Proposer à un autre livreur"
                  : "Demander un livreur"}
              </LinkButton>
              {status === "processing" ? (
                <Button size="sm" variant="ghost" disabled={loading} onClick={() => setMode("ship")}>
                  J&apos;expédie moi-même
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

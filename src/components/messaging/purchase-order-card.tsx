"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import {
  cancelPurchaseOrder,
  declinePurchaseOrder,
} from "@/app/compte/messages/purchase-order-actions";
import { Button, LinkButton } from "@/components/ui/button";
import { formatFcfa, formatPct } from "@/lib/format";
import { feeFromPct } from "@/lib/orders";
import type { PurchaseOrderView } from "@/lib/purchase-orders";
import { cn } from "@/lib/utils";

export type ThreadViewer = "buyer" | "seller" | "admin";

const STATE_LABELS: Record<
  PurchaseOrderView["state"],
  { buyer: string; other: string; tone: string }
> = {
  sent: {
    buyer: "En attente de votre réponse",
    other: "En attente de l'acheteur",
    tone: "bg-gold/15 text-gold",
  },
  accepted: { buyer: "Accepté", other: "Accepté", tone: "bg-emerald/15 text-emerald" },
  declined: { buyer: "Refusé", other: "Refusé", tone: "bg-danger/15 text-danger" },
  cancelled: { buyer: "Annulé", other: "Annulé", tone: "bg-white/10 text-ink-muted" },
  expired: { buyer: "Expiré", other: "Expiré", tone: "bg-white/10 text-ink-muted" },
};

function formatDateTime(date: Date) {
  return date.toLocaleString("fr-FR", {
    timeZone: "Africa/Lome",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Carte d'un bon de commande dans le fil (docs/CHANGEMENTS.md §5, lot 3) :
 * lignes aux prix négociés, livraison, frais de service acheteur, validité.
 * L'acheteur accepte (paiement) ou refuse ; le vendeur modifie ou annule ;
 * une fois accepté, la carte mène au paiement puis à la commande.
 */
export function PurchaseOrderCard({
  po,
  viewer,
  serviceFeePct,
  editHref,
}: {
  po: PurchaseOrderView;
  viewer: ThreadViewer;
  serviceFeePct: number;
  /** Vendeur : lien vers le formulaire prérempli pour modifier le bon. */
  editHref?: string;
}) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceFee = feeFromPct(po.subtotalFcfa, serviceFeePct);
  const total = po.order?.totalFcfa ?? po.subtotalFcfa + po.deliveryFeeFcfa + serviceFee;
  const label = STATE_LABELS[po.state];

  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setDeclining(false);
      router.refresh();
    }
  }

  return (
    <div className="flex w-80 max-w-full flex-col gap-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="size-5 shrink-0 text-gold" />
          <div>
            <p className="font-display font-bold">Bon de commande</p>
            <p className="font-label text-[11px] text-ink-muted">{po.number}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 font-label text-[10px] font-semibold",
            label.tone,
          )}
        >
          {viewer === "buyer" ? label.buyer : label.other}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {po.items.map((item, index) => (
          <li key={index} className="flex justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate">{item.title}</span>
              <span className="text-xs text-ink-muted">
                {item.quantity} × {formatFcfa(item.unitPriceFcfa)}
              </span>
            </span>
            <span className="shrink-0">{formatFcfa(item.totalFcfa)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-0.5 border-t border-white/10 pt-2 text-xs text-ink-muted">
        <p className="flex justify-between">
          <span>Livraison</span>
          <span>{formatFcfa(po.deliveryFeeFcfa)}</span>
        </p>
        {serviceFee > 0 || po.order ? (
          <p className="flex justify-between">
            <span>Frais de service acheteur{po.order ? "" : ` (${formatPct(serviceFeePct)})`}</span>
            <span>
              {formatFcfa(
                po.order
                  ? po.order.totalFcfa - po.subtotalFcfa - po.deliveryFeeFcfa
                  : serviceFee,
              )}
            </span>
          </p>
        ) : null}
        <p className="mt-1 flex justify-between font-display text-sm font-bold text-ink">
          <span>Total</span>
          <span className="text-gold">{formatFcfa(total)}</span>
        </p>
      </div>

      {po.note ? (
        <p className="rounded-md bg-white/[0.04] p-2 text-xs whitespace-pre-line text-ink-muted">
          {po.note}
        </p>
      ) : null}

      {po.state === "sent" ? (
        <p className="text-xs text-ink-muted">
          Valable jusqu&apos;au {formatDateTime(po.expiresAt)}
        </p>
      ) : null}
      {po.state === "declined" && po.declineReason ? (
        <p className="text-xs text-danger">Motif : {po.declineReason}</p>
      ) : null}

      {po.state === "accepted" && po.order ? (
        viewer === "buyer" ? (
          po.order.status === "pending_payment" ? (
            <LinkButton href={`/compte/commandes/${po.order.id}`} size="sm">
              Payer maintenant · {formatFcfa(po.order.totalFcfa)}
            </LinkButton>
          ) : (
            <Link
              href={`/compte/commandes/${po.order.id}`}
              className="font-label text-xs text-emerald hover:underline"
            >
              Commande {po.order.number} ›
            </Link>
          )
        ) : (
          <p className="text-xs text-ink-muted">
            Commande {po.order.number}
            {po.order.status === "pending_payment" ? " - en attente de paiement" : ""}
          </p>
        )
      ) : null}

      {po.state === "sent" && viewer === "buyer" && !declining ? (
        <div className="flex gap-2">
          <LinkButton href={`/commande?bon=${po.id}`} size="sm" className="flex-1">
            Accepter et commander
          </LinkButton>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeclining(true)}
            disabled={busy}
          >
            Refuser
          </Button>
        </div>
      ) : null}

      {declining ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Motif (facultatif) : prix, délai, quantité…"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={busy}
              onClick={() => run(() => declinePurchaseOrder(po.id, reason))}
            >
              Confirmer le refus
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDeclining(false)}>
              Retour
            </Button>
          </div>
        </div>
      ) : null}

      {po.state === "sent" && viewer === "seller" ? (
        <div className="flex gap-2">
          {editHref ? (
            <LinkButton href={editHref} size="sm" variant="secondary" className="flex-1">
              Modifier
            </LinkButton>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            loading={busy}
            onClick={() => run(() => cancelPurchaseOrder(po.id))}
          >
            Annuler le bon
          </Button>
        </div>
      ) : null}

      <a
        href={`/api/bons/${po.id}`}
        target="_blank"
        rel="noreferrer"
        className="font-label text-[11px] text-ink-muted hover:text-emerald"
      >
        Télécharger le bon (PDF)
      </a>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DocumentMagnifyingGlassIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { requestQuote } from "@/app/compte/messages/purchase-order-actions";
import { Button } from "@/components/ui/button";
import type { CatalogOption } from "@/components/messaging/purchase-order-form";

const inputClass =
  "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none";

/**
 * Demande de devis (acheteur) : produit de la boutique (facultatif),
 * quantité souhaitée et précisions. Le vendeur répond par un bon de
 * commande à prix négociés.
 */
export function QuoteRequestComposer({
  conversationId,
  catalog,
  initialProductId,
}: {
  conversationId: string;
  catalog: CatalogOption[];
  /** Produit d'où vient l'acheteur (fiche produit), présélectionné. */
  initialProductId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState(initialProductId ?? "");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setBlocked(false);
    setLoading(true);
    const result = await requestQuote(conversationId, {
      productId: productId || null,
      quantity: Math.round(Number(quantity)),
      note,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setBlocked(Boolean(result.blocked));
      return;
    }
    setOpen(false);
    setQuantity("");
    setNote("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <DocumentMagnifyingGlassIcon className="size-4" />
        Demander un devis
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-emerald/30 bg-emerald/[0.05] p-4">
      <div>
        <p className="font-display font-bold">Demande de devis</p>
        <p className="text-xs text-ink-muted">
          Le vendeur vous répondra par un bon de commande (prix, livraison,
          validité) que vous pourrez accepter et payer en toute sécurité.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          aria-label="Produit"
          className={`${inputClass} bg-navy-deep`}
        >
          <option value="">Plusieurs produits / autre demande</option>
          {catalog.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Quantité"
          aria-label="Quantité souhaitée"
          className={inputClass}
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Précisions : délai souhaité, variante, conditionnement…"
        className={inputClass}
      />
      {error ? (
        <div
          role="alert"
          className={
            blocked
              ? "flex gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              : "text-sm text-danger"
          }
        >
          {blocked ? <ShieldExclamationIcon className="size-5 shrink-0" /> : null}
          <p>{error}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={submit}
          loading={loading}
          disabled={!(Number(quantity) >= 1)}
        >
          Envoyer la demande
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

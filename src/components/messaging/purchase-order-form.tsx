"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  DocumentPlusIcon,
  ShieldExclamationIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { createPurchaseOrder } from "@/app/compte/messages/purchase-order-actions";
import { Button } from "@/components/ui/button";
import { formatFcfa, formatPct } from "@/lib/format";
import { feeFromPct } from "@/lib/orders";

export type CatalogOption = {
  id: string;
  title: string;
  priceFcfa: number;
  stock: number;
};

export type PurchaseOrderPrefill = {
  lines: {
    productId: string | null;
    title: string;
    quantity: number;
    unitPriceFcfa: number;
  }[];
  deliveryFeeFcfa?: number;
  note?: string | null;
  /** Bon ouvert remplacé par celui-ci (modification). */
  replace?: { id: string; number: string };
};

type LineState = {
  key: number;
  productId: string | null;
  title: string;
  quantity: string;
  unitPrice: string;
};

const VALIDITY_OPTIONS = [
  { hours: 24, label: "24 heures" },
  { hours: 48, label: "48 heures" },
  { hours: 72, label: "3 jours" },
  { hours: 168, label: "7 jours" },
];

const inputClass =
  "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none";

let nextKey = 1;

/**
 * Émission d'un bon de commande par le vendeur (docs/CHANGEMENTS.md §5,
 * lot 3) : produits de sa boutique ou lignes libres, prix librement fixés,
 * livraison et durée de validité. Ouvert d'office quand on arrive d'une
 * demande de devis, d'une fiche produit ou d'une modification.
 */
export function PurchaseOrderComposer({
  conversationId,
  catalog,
  defaultDeliveryFee,
  serviceFeePct,
  prefill,
}: {
  conversationId: string;
  catalog: CatalogOption[];
  defaultDeliveryFee: number;
  serviceFeePct: number;
  prefill?: PurchaseOrderPrefill;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(Boolean(prefill));
  const [lines, setLines] = useState<LineState[]>(() =>
    (prefill?.lines.length ? prefill.lines : []).map((line) => ({
      key: nextKey++,
      productId: line.productId,
      title: line.title,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPriceFcfa),
    })),
  );
  const [deliveryFee, setDeliveryFee] = useState(
    String(prefill?.deliveryFeeFcfa ?? defaultDeliveryFee),
  );
  const [validityHours, setValidityHours] = useState(72);
  const [note, setNote] = useState(prefill?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const byId = new Map(catalog.map((product) => [product.id, product]));
  const subtotal = lines.reduce(
    (sum, line) =>
      sum + (Math.round(Number(line.quantity)) || 0) * (Math.round(Number(line.unitPrice)) || 0),
    0,
  );
  const delivery = Math.max(0, Math.round(Number(deliveryFee)) || 0);
  const serviceFee = feeFromPct(subtotal, serviceFeePct);

  function update(key: number, patch: Partial<LineState>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function addProductLine() {
    const first = catalog[0];
    setLines((current) => [
      ...current,
      {
        key: nextKey++,
        productId: first?.id ?? null,
        title: first?.title ?? "",
        quantity: "1",
        unitPrice: String(first?.priceFcfa ?? ""),
      },
    ]);
  }

  function addFreeLine() {
    setLines((current) => [
      ...current,
      { key: nextKey++, productId: null, title: "", quantity: "1", unitPrice: "" },
    ]);
  }

  function close() {
    setOpen(false);
    setError(null);
    // Retire ?bon=… de l'adresse (arrivée depuis un devis ou une modification).
    router.replace(pathname, { scroll: false });
  }

  async function submit() {
    setError(null);
    setBlocked(false);
    setLoading(true);
    const result = await createPurchaseOrder(
      conversationId,
      {
        lines: lines.map((line) => ({
          productId: line.productId,
          title: line.title,
          quantity: Math.round(Number(line.quantity)),
          unitPriceFcfa: Math.round(Number(line.unitPrice)),
        })),
        deliveryFeeFcfa: delivery,
        validityHours,
        note,
      },
      prefill?.replace?.id,
    );
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setBlocked(Boolean(result.blocked));
      return;
    }
    setLines([]);
    setNote("");
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => {
          setOpen(true);
          if (lines.length === 0) addProductLine();
        }}
      >
        <DocumentPlusIcon className="size-4" />
        Créer un bon de commande
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold/30 bg-gold/[0.05] p-4">
      <div>
        <p className="font-display font-bold">
          {prefill?.replace
            ? `Modifier le bon ${prefill.replace.number}`
            : "Nouveau bon de commande"}
        </p>
        <p className="text-xs text-ink-muted">
          {prefill?.replace
            ? "Le bon actuel sera annulé et remplacé par celui-ci."
            : "Prix librement fixés. Accepté par l'acheteur, le bon devient une commande avec paiement sécurisé."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {lines.map((line) => {
          const product = line.productId ? byId.get(line.productId) : null;
          const quantity = Math.round(Number(line.quantity)) || 0;
          return (
            <div
              key={line.key}
              className="grid gap-2 rounded-md border border-white/[0.06] p-3 sm:grid-cols-[1fr_5.5rem_7.5rem_auto]"
            >
              {line.productId !== null ? (
                <select
                  value={line.productId}
                  onChange={(e) => {
                    const chosen = byId.get(e.target.value);
                    update(line.key, {
                      productId: e.target.value,
                      title: chosen?.title ?? "",
                      unitPrice: String(chosen?.priceFcfa ?? line.unitPrice),
                    });
                  }}
                  aria-label="Produit"
                  className={`${inputClass} bg-navy-deep`}
                >
                  {catalog.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} ({option.stock} en stock)
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={line.title}
                  onChange={(e) => update(line.key, { title: e.target.value })}
                  placeholder="Intitulé (ex. personnalisation, emballage…)"
                  maxLength={120}
                  aria-label="Intitulé de la ligne"
                  className={inputClass}
                />
              )}
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={line.quantity}
                onChange={(e) => update(line.key, { quantity: e.target.value })}
                aria-label="Quantité"
                className={inputClass}
              />
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={line.unitPrice}
                onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                placeholder="Prix unitaire"
                aria-label="Prix unitaire (FCFA)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  setLines((current) => current.filter((l) => l.key !== line.key))
                }
                aria-label="Retirer la ligne"
                className="flex items-center justify-center rounded-md px-2 text-ink-muted hover:text-danger"
              >
                <TrashIcon className="size-4" />
              </button>
              {product && quantity > product.stock ? (
                <p className="text-xs text-danger sm:col-span-4">
                  Stock insuffisant : {product.stock} disponible
                  {product.stock > 1 ? "s" : ""}.
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {catalog.length > 0 ? (
            <Button type="button" size="sm" variant="ghost" onClick={addProductLine}>
              + Produit du catalogue
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={addFreeLine}>
            + Ligne libre
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Frais de livraison (FCFA)
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={deliveryFee}
            onChange={(e) => setDeliveryFee(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Validité du bon
          <select
            value={validityHours}
            onChange={(e) => setValidityHours(Number(e.target.value))}
            className={`${inputClass} bg-navy-deep`}
          >
            {VALIDITY_OPTIONS.map((option) => (
              <option key={option.hours} value={option.hours}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Note pour l'acheteur (délai, conditions…) - facultatif"
        className={inputClass}
      />

      <div className="flex flex-col gap-0.5 rounded-md bg-white/[0.03] p-3 text-sm">
        <p className="flex justify-between text-ink-muted">
          <span>Articles</span>
          <span>{formatFcfa(subtotal)}</span>
        </p>
        <p className="flex justify-between text-ink-muted">
          <span>Livraison</span>
          <span>{formatFcfa(delivery)}</span>
        </p>
        {serviceFee > 0 ? (
          <p className="flex justify-between text-ink-muted">
            <span>Frais de service acheteur ({formatPct(serviceFeePct)})</span>
            <span>{formatFcfa(serviceFee)}</span>
          </p>
        ) : null}
        <p className="mt-1 flex justify-between font-display font-bold">
          <span>Total acheteur</span>
          <span className="text-gold">
            {formatFcfa(subtotal + delivery + serviceFee)}
          </span>
        </p>
      </div>

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
          disabled={lines.length === 0}
        >
          {prefill?.replace ? "Envoyer le bon modifié" : "Envoyer le bon de commande"}
        </Button>
        <Button type="button" variant="ghost" onClick={close}>
          Fermer
        </Button>
      </div>
    </div>
  );
}

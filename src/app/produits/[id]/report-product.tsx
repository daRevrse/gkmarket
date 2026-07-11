"use client";

import { useState } from "react";
import Link from "next/link";
import { reportProduct } from "./actions";
import { Button } from "@/components/ui/button";
import { productReportReasonLabels } from "@/lib/product-reports";

/** Signalement discret d'un produit (MVP n°275), réservé aux connectés. */
export function ReportProduct({
  productId,
  productPath,
  isLoggedIn,
}: {
  productId: string;
  productPath: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isLoggedIn) {
    return (
      <p className="text-xs text-ink-muted">
        Un problème avec cette annonce ?{" "}
        <Link
          href={`/connexion?next=${encodeURIComponent(productPath)}`}
          className="text-emerald hover:underline"
        >
          Connectez-vous pour la signaler
        </Link>
        .
      </p>
    );
  }

  if (sent) {
    return (
      <p className="text-xs text-emerald">
        Merci, votre signalement a été transmis à notre équipe.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-label text-xs text-ink-muted hover:text-danger"
      >
        Signaler ce produit
      </button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError("Choisissez un motif.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await reportProduct(productId, reason, details);
    setLoading(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3"
    >
      <p className="font-label text-sm font-semibold">Signaler ce produit</p>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        required
      >
        <option value="">Motif…</option>
        {Object.entries(productReportReasonLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={2}
        placeholder="Précisions (optionnel)"
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => setOpen(false)}
        >
          Annuler
        </Button>
        <Button type="submit" size="sm" variant="danger" loading={loading}>
          Envoyer le signalement
        </Button>
      </div>
    </form>
  );
}

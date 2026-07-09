"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveDispute } from "../actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { disputeResolutionLabels } from "@/lib/disputes";

export function DecisionPanel({
  disputeId,
  subtotalFcfa,
  totalFcfa,
}: {
  disputeId: string;
  subtotalFcfa: number;
  totalFcfa: number;
}) {
  const router = useRouter();
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await resolveDispute(disputeId, {
      resolution,
      refundFcfa: resolution === "refund_partial" ? Number(refund) : undefined,
      note,
    });
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />

      <FormField label="Décision" htmlFor="resolution">
        <select
          id="resolution"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          required
          className="w-full rounded-md border border-white/10 bg-navy-deep px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
        >
          <option value="">- Choisir -</option>
          {Object.entries(disputeResolutionLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      {resolution === "refund_total" ? (
        <p className="text-sm text-ink-muted">
          L&apos;acheteur récupère la totalité ({totalFcfa.toLocaleString("fr-FR")}{" "}
          FCFA) ; ni le vendeur ni le livreur ne sont payés.
        </p>
      ) : null}
      {resolution === "release_seller" ? (
        <p className="text-sm text-ink-muted">
          Versement normal : vendeur net de commission, frais de course au
          livreur s&apos;il a effectué la livraison.
        </p>
      ) : null}

      {resolution === "refund_partial" ? (
        <FormField
          label={`Montant remboursé à l'acheteur (1 à ${(subtotalFcfa - 1).toLocaleString("fr-FR")} FCFA)`}
          htmlFor="refund"
        >
          <Input
            id="refund"
            type="number"
            min={1}
            max={subtotalFcfa - 1}
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            required
          />
        </FormField>
      ) : null}

      <FormField
        label="Note de décision (visible par l'acheteur et le vendeur)"
        htmlFor="note"
      >
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          rows={3}
          placeholder="Motivez la décision : preuves retenues, responsabilité…"
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 font-body text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] focus:border-emerald focus:outline-none focus:shadow-[0_0_0_3px_rgb(0_200_150_/_0.15)]"
        />
      </FormField>

      <Button type="submit" disabled={loading} className="self-start">
        {loading ? "Exécution…" : "Trancher le litige"}
      </Button>
    </form>
  );
}

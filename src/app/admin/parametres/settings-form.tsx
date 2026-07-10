"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePlatformSettings } from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SettingsForm({
  commissionRatePct,
  deliveryFeeFcfa,
}: {
  commissionRatePct: number;
  deliveryFeeFcfa: number;
}) {
  const router = useRouter();
  const [commission, setCommission] = useState(String(commissionRatePct));
  const [fee, setFee] = useState(String(deliveryFeeFcfa));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setOk(false);
    setLoading(true);
    const result = await updatePlatformSettings({
      commissionRatePct: Number(commission),
      deliveryFeeFcfa: Number(fee),
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOk(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />
      {ok ? (
        <p className="rounded-md border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-emerald-light">
          Paramètres enregistrés ✓
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Commission plateforme (%)" htmlFor="commission">
          <Input
            id="commission"
            type="number"
            min={0}
            max={50}
            step="0.5"
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Frais de livraison par vendeur (FCFA)" htmlFor="fee">
          <Input
            id="fee"
            type="number"
            min={0}
            max={100000}
            step="50"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
          />
        </FormField>
      </div>

      <p className="text-xs text-ink-muted">
        La commission s&apos;applique aux prochains versements vendeurs
        (déblocage des fonds) ; les frais de livraison aux prochains paniers.
        Les commandes déjà passées ne changent pas.
      </p>

      <Button type="submit" loading={loading} className="self-start">
        {loading ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

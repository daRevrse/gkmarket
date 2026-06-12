"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { proposeDelivery } from "../../actions";
import { FormError } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { vehicleTypeLabels } from "@/lib/deliveries";

export type CourierCandidate = {
  id: string;
  name: string;
  vehicleType: string;
  city: string;
  district: string | null;
  serviceArea: string | null;
  contactPhone: string | null;
  activeCourses: number;
  score: number;
};

export function CourierPicker({
  orderId,
  candidates,
}: {
  orderId: string;
  candidates: CourierCandidate[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function propose(courierId: string) {
    setError(null);
    setLoadingId(courierId);
    const result = await proposeDelivery(orderId, courierId);
    setLoadingId(null);
    if (result.error) setError(result.error);
    else router.push("/vendeur/commandes");
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError message={error} />
      {candidates.map((courier, index) => (
        <Card key={courier.id}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold">
                  {courier.name}
                </h2>
                {index === 0 && courier.score > 0 ? (
                  <Badge variant="verified">Recommandé</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {vehicleTypeLabels[courier.vehicleType] ?? courier.vehicleType}{" "}
                · {[courier.city, courier.district].filter(Boolean).join(" · ")}
                {courier.contactPhone ? ` · ${courier.contactPhone}` : ""}
              </p>
              {courier.serviceArea ? (
                <p className="mt-1 text-sm text-ink-muted">
                  Zones : {courier.serviceArea}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-ink-muted">
                {courier.activeCourses === 0
                  ? "Disponible — aucune course en cours"
                  : `${courier.activeCourses} course${courier.activeCourses > 1 ? "s" : ""} en cours`}
              </p>
            </div>
            <Button
              size="sm"
              disabled={loadingId !== null}
              onClick={() => propose(courier.id)}
            >
              {loadingId === courier.id ? "Envoi…" : "Proposer la course"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

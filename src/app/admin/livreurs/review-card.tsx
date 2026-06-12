"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveCourier, rejectCourier } from "./actions";
import { FormError } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { vehicleTypeLabels } from "@/lib/deliveries";

export type CourierApplication = {
  id: string;
  vehicleType: string;
  city: string;
  district: string | null;
  serviceArea: string | null;
  contactPhone: string | null;
  idDocumentPath: string;
  status: string;
  rejectionReason: string | null;
  createdAt: string;
  applicantName: string | null;
  applicantEmail: string | null;
  applicantPhone: string | null;
};

const statusBadge: Record<string, { label: string; variant?: "verified" | "neutral" }> = {
  pending: { label: "En attente" },
  approved: { label: "Approuvé", variant: "verified" },
  rejected: { label: "Refusé", variant: "neutral" },
  suspended: { label: "Suspendu", variant: "neutral" },
};

export function CourierReviewCard({
  application,
}: {
  application: CourierApplication;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const badge = statusBadge[application.status] ?? { label: application.status };

  async function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    setLoading(true);
    const result = await action();
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setRejecting(false);
      router.refresh();
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-bold">
              {application.applicantName ?? "Candidat livreur"}
            </h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {vehicleTypeLabels[application.vehicleType] ?? application.vehicleType}{" "}
            ·{" "}
            {[application.city, application.district].filter(Boolean).join(" · ")}
          </p>
          {application.serviceArea ? (
            <p className="mt-2 text-sm">
              <span className="text-ink-muted">Zones desservies :</span>{" "}
              {application.serviceArea}
            </p>
          ) : null}
          <p className="mt-3 text-sm">
            <span className="text-ink-muted">Contact :</span>{" "}
            {application.applicantEmail ?? "—"}{" "}
            <span className="text-ink-muted">
              ({application.contactPhone ?? application.applicantPhone ?? "—"})
            </span>
          </p>
          <p className="text-xs text-ink-muted">
            Demande du {new Date(application.createdAt).toLocaleDateString("fr-FR")}
          </p>
          {application.rejectionReason ? (
            <p className="mt-2 text-sm text-danger">
              Motif du refus : {application.rejectionReason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <a
            href={`/api/admin/kyc?path=${encodeURIComponent(application.idDocumentPath)}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-emerald px-3 py-1.5 text-sm text-emerald hover:bg-emerald/10"
          >
            Pièce d&apos;identité
          </a>

          {application.status === "pending" ? (
            <div className="mt-2 flex flex-col items-end gap-3">
              <FormError message={error} />
              {rejecting ? (
                <div className="flex flex-col items-end gap-2">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Motif du refus (visible par le livreur)"
                    className="w-72"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={loading}
                      onClick={() => run(() => rejectCourier(application.id, reason))}
                    >
                      Confirmer le refus
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setRejecting(false)}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={loading}
                    onClick={() => run(() => approveCourier(application.id))}
                  >
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={loading}
                    onClick={() => setRejecting(true)}
                  >
                    Refuser
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

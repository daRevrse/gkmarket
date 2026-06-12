"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveSeller, rejectSeller, setSellerSuspension } from "./actions";
import { FormError } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type SellerApplication = {
  id: string;
  shopName: string;
  shopDescription: string | null;
  city: string;
  district: string | null;
  contactPhone: string | null;
  rccm: string | null;
  idDocumentPath: string;
  rccmDocumentPath: string | null;
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

export function ReviewCard({ application }: { application: SellerApplication }) {
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
              {application.shopName}
            </h2>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {[application.city, application.district]
              .filter(Boolean)
              .join(" · ")}
            {application.rccm ? ` · RCCM ${application.rccm}` : " · Informel"}
          </p>
          {application.shopDescription ? (
            <p className="mt-2 text-sm">{application.shopDescription}</p>
          ) : null}
          <p className="mt-3 text-sm">
            <span className="text-ink-muted">Demandeur :</span>{" "}
            {application.applicantName ?? "—"}{" "}
            <span className="text-ink-muted">
              ({application.applicantEmail ?? application.applicantPhone ?? "—"})
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
          <div className="flex gap-2">
            <a
              href={`/api/admin/kyc?path=${encodeURIComponent(application.idDocumentPath)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-emerald px-3 py-1.5 text-sm text-emerald hover:bg-emerald/10"
            >
              Pièce d&apos;identité
            </a>
            {application.rccmDocumentPath ? (
              <a
                href={`/api/admin/kyc?path=${encodeURIComponent(application.rccmDocumentPath)}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-emerald px-3 py-1.5 text-sm text-emerald hover:bg-emerald/10"
              >
                Document RCCM
              </a>
            ) : null}
          </div>

          {application.status === "approved" ? (
            <div className="mt-2 flex flex-col items-end gap-2">
              <FormError message={error} />
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => run(() => setSellerSuspension(application.id, true))}
              >
                Suspendre la boutique
              </Button>
            </div>
          ) : null}
          {application.status === "suspended" ? (
            <div className="mt-2 flex flex-col items-end gap-2">
              <FormError message={error} />
              <Button
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={() => run(() => setSellerSuspension(application.id, false))}
              >
                Réactiver la boutique
              </Button>
            </div>
          ) : null}
          {application.status === "pending" ? (
            <div className="mt-2 flex flex-col items-end gap-3">
              <FormError message={error} />
              {rejecting ? (
                <div className="flex flex-col items-end gap-2">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Motif du refus (visible par le vendeur)"
                    className="w-72"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={loading}
                      onClick={() => run(() => rejectSeller(application.id, reason))}
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
                    onClick={() => run(() => approveSeller(application.id))}
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

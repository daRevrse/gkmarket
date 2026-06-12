"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder } from "./actions";
import { Button, LinkButton } from "@/components/ui/button";

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

  async function run(to: "processing" | "shipped") {
    setError(null);
    setLoading(true);
    const result = await advanceOrder(orderId, to);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  if (status !== "paid" && status !== "processing") return null;

  // Course en cours (proposée, acceptée, colis récupéré ou remis) : c'est le
  // livreur qui fait avancer la livraison, plus d'expédition manuelle.
  const hasActiveDelivery =
    deliveryStatus !== null &&
    deliveryStatus !== "refused" &&
    deliveryStatus !== "cancelled";

  return (
    <div className="mt-3 flex flex-col items-end gap-2 border-t border-white/[0.06] pt-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {status === "paid" ? (
          <Button size="sm" disabled={loading} onClick={() => run("processing")}>
            {loading ? "…" : "Marquer en préparation"}
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
              <Button
                size="sm"
                variant="ghost"
                disabled={loading}
                onClick={() => run("shipped")}
              >
                {loading ? "…" : "J'expédie moi-même"}
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

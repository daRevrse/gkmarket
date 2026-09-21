"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setReviewHidden } from "./actions";
import { Button } from "@/components/ui/button";

/** Masquer ou réafficher un avis. */
export function ReviewModeration({
  kind,
  reviewId,
  hidden,
}: {
  kind: "product" | "seller";
  reviewId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <Button
        size="sm"
        variant={hidden ? "secondary" : "danger"}
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const result = await setReviewHidden(kind, reviewId, !hidden);
          setLoading(false);
          if (result.error) setError(result.error);
          else router.refresh();
        }}
      >
        {hidden ? "Réafficher" : "Masquer"}
      </Button>
    </div>
  );
}

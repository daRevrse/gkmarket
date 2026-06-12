"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moderateProduct } from "./actions";
import { Button } from "@/components/ui/button";

export function ProductModeration({
  productId,
  status,
}: {
  productId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(action: "archive" | "restore") {
    setError(null);
    setLoading(true);
    const result = await moderateProduct(productId, action);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {status === "published" ? (
        <Button
          size="sm"
          variant="danger"
          disabled={loading}
          onClick={() => run("archive")}
        >
          {loading ? "…" : "Retirer du catalogue"}
        </Button>
      ) : status === "archived" ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={loading}
          onClick={() => run("restore")}
        >
          {loading ? "…" : "Republier"}
        </Button>
      ) : null}
    </div>
  );
}

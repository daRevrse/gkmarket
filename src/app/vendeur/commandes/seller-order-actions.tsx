"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { advanceOrder } from "./actions";
import { Button } from "@/components/ui/button";

export function SellerOrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
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

  return (
    <div className="mt-3 flex flex-col items-end gap-2 border-t border-white/[0.06] pt-3">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {status === "paid" ? (
        <Button size="sm" disabled={loading} onClick={() => run("processing")}>
          {loading ? "…" : "Marquer en préparation"}
        </Button>
      ) : (
        <Button size="sm" disabled={loading} onClick={() => run("shipped")}>
          {loading ? "…" : "Marquer expédiée"}
        </Button>
      )}
    </div>
  );
}

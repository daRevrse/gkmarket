"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { handleProductReport } from "./actions";
import { Button } from "@/components/ui/button";

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(outcome: "archive" | "dismiss") {
    setError(null);
    setLoading(true);
    const result = await handleProductReport(reportId, outcome);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={loading}
          onClick={() => run("archive")}
        >
          Retirer le produit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => run("dismiss")}
        >
          Sans suite
        </Button>
      </div>
    </div>
  );
}

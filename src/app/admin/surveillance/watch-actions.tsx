"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { liftWatch, markViolationsReviewed } from "./actions";
import { Button } from "@/components/ui/button";

export function WatchActions({
  userId,
  openCount,
  watched,
}: {
  userId: string;
  openCount: number;
  watched: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (id: string) => Promise<{ error?: string }>) {
    setLoading(true);
    setError(null);
    const result = await action(userId);
    setLoading(false);
    if (result.error) setError(result.error);
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {openCount > 0 ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => run(markViolationsReviewed)}
          >
            Marquer comme examiné
          </Button>
        ) : null}
        {watched ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            onClick={() => run(liftWatch)}
          >
            Lever la surveillance
          </Button>
        ) : null}
      </div>
    </div>
  );
}

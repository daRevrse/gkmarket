"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runEscrowAutoRelease } from "./actions";
import { Button } from "@/components/ui/button";

export function EscrowReleaseButton() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setMessage(null);
    setLoading(true);
    const result = await runEscrowAutoRelease();
    setLoading(false);
    if (result.error) setMessage(result.error);
    else {
      setMessage(
        result.released === 0
          ? "Aucune commande à libérer."
          : `${result.released} commande${(result.released ?? 0) > 1 ? "s" : ""} libérée${(result.released ?? 0) > 1 ? "s" : ""}.`,
      );
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button size="sm" variant="secondary" disabled={loading} onClick={run}>
        {loading ? "Exécution…" : "Exécuter le déblocage automatique"}
      </Button>
      {message ? <span className="text-sm text-ink-muted">{message}</span> : null}
    </div>
  );
}

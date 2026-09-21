"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { indexImages } from "./actions";
import { Button } from "@/components/ui/button";

/**
 * Rattrapage de l'index visuel : un lot de 25 photos par clic, pour garder
 * la main sur la charge du serveur.
 */
export function ImageIndexRunner({ pending }: { pending: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        variant="secondary"
        loading={loading}
        disabled={pending === 0}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          const result = await indexImages();
          setLoading(false);
          const parts = [];
          if (result.done) parts.push(`${result.done} photo(s) indexée(s)`);
          if (result.failed) {
            parts.push(`${result.failed} illisible(s) dans le stockage`);
          }
          setMessage(
            result.error ??
              (parts.length > 0 ? `${parts.join(", ")}.` : "Rien à indexer."),
          );
          router.refresh();
        }}
      >
        {pending === 0 ? "Index à jour" : "Indexer 25 photos"}
      </Button>
      {message ? <span className="text-sm text-ink-muted">{message}</span> : null}
    </div>
  );
}

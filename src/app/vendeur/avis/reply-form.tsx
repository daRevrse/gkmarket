"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { replyToReview } from "./actions";
import { Button } from "@/components/ui/button";

/** Réponse publique du vendeur à un avis reçu. */
export function ReplyForm({
  kind,
  reviewId,
}: {
  kind: "product" | "seller";
  reviewId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Répondre
      </Button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Votre réponse, visible par tous les acheteurs"
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
      />
      {error ? (
        <div
          role="alert"
          className={
            blocked
              ? "flex gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              : "text-sm text-danger"
          }
        >
          {blocked ? <ShieldExclamationIcon className="size-5 shrink-0" /> : null}
          <p>{error}</p>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={loading}
          disabled={!reply.trim()}
          onClick={async () => {
            setLoading(true);
            setError(null);
            const result = await replyToReview(kind, reviewId, reply);
            setLoading(false);
            if (result.error) {
              setError(result.error);
              setBlocked(Boolean(result.blocked));
              return;
            }
            setOpen(false);
            router.refresh();
          }}
        >
          Publier la réponse
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
    </div>
  );
}

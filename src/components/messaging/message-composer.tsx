"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendMessage } from "@/app/compte/messages/actions";
import { Button } from "@/components/ui/button";

/** Zone de saisie + envoi d'un message dans une conversation. */
export function MessageComposer({
  conversationId,
  initialBody = "",
}: {
  conversationId: string;
  /** Sujet prérempli (ex. depuis une fiche produit ou une commande). */
  initialBody?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);
    const result = await sendMessage(conversationId, body);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="Écrivez votre message… (Entrée pour envoyer)"
          className="min-h-[52px] w-full flex-1 resize-y rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
        />
        <Button type="submit" loading={loading} disabled={!body.trim()}>
          Envoyer
        </Button>
      </div>
    </form>
  );
}

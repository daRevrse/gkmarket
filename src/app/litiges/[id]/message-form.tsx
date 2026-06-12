"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postDisputeMessage } from "../actions";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export function MessageForm({ disputeId }: { disputeId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await postDisputeMessage(disputeId, body);
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setBody("");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={3}
        placeholder="Votre message aux autres parties…"
        className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 font-body text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] focus:border-emerald focus:outline-none focus:shadow-[0_0_0_3px_rgb(0_200_150_/_0.15)]"
      />
      <Button type="submit" size="sm" disabled={loading} className="self-end">
        {loading ? "Envoi…" : "Envoyer"}
      </Button>
    </form>
  );
}

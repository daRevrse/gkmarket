"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import { openDispute } from "@/app/litiges/actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { disputeReasonLabels } from "@/lib/disputes";
import { auth, storage } from "@/lib/firebase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 4;

export function DisputeForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} dépasse 5 Mo.`);
        return;
      }
    }
    const uid = auth.currentUser?.uid;
    if (files.length > 0 && !uid) {
      setError(
        "Session expirée : déconnectez-vous puis reconnectez-vous pour envoyer vos preuves.",
      );
      return;
    }

    setLoading(true);
    try {
      const evidencePaths: string[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `disputes/${uid}/${orderId}-${Date.now()}-${safeName}`;
        await uploadBytes(ref(storage, path), file, {
          contentType: file.type,
        });
        evidencePaths.push(path);
      }

      const result = await openDispute(orderId, {
        reason,
        description,
        evidencePaths,
      });
      if (result.error || !result.disputeId) {
        setError(result.error ?? "L'ouverture du litige a échoué.");
        setLoading(false);
        return;
      }
      router.push(`/litiges/${result.disputeId}`);
    } catch {
      setError("L'envoi des preuves a échoué. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />

      <FormField label="Motif du litige" htmlFor="reason">
        <select
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          className="w-full rounded-md border border-white/10 bg-navy-deep px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
        >
          <option value="">- Choisir -</option>
          {Object.entries(disputeReasonLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Description détaillée du problème" htmlFor="description">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={20}
          rows={5}
          placeholder="Décrivez précisément ce qui ne va pas : état du colis, différences avec l'annonce, dates…"
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 font-body text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] focus:border-emerald focus:outline-none focus:shadow-[0_0_0_3px_rgb(0_200_150_/_0.15)]"
        />
      </FormField>

      <FormField
        label={`Photos de preuve (jusqu'à ${MAX_FILES}, recommandées)`}
        htmlFor="evidence"
      >
        <input
          id="evidence"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) =>
            setFiles([...(e.target.files ?? [])].slice(0, MAX_FILES))
          }
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-muted file:mr-4 file:rounded-sm file:border-0 file:bg-emerald/20 file:px-3 file:py-1 file:text-emerald"
        />
      </FormField>
      {files.length > 0 ? (
        <p className="text-xs text-ink-muted">
          {files.length} photo{files.length > 1 ? "s" : ""} :{" "}
          {files.map((f) => f.name).join(", ")}
        </p>
      ) : null}

      <Button type="submit" disabled={loading} className="mt-2 self-start">
        {loading ? "Ouverture…" : "Ouvrir le litige"}
      </Button>
    </form>
  );
}

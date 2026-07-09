"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes } from "firebase/storage";
import {
  acceptDelivery,
  markDelivered,
  markPickedUp,
  refuseDelivery,
} from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, storage } from "@/lib/firebase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function CourseActions({
  deliveryId,
  status,
}: {
  deliveryId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [delivering, setDelivering] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  if (status !== "proposed" && status !== "accepted" && status !== "picked_up") {
    return null;
  }

  async function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    setLoading(true);
    const result = await action();
    setLoading(false);
    if (result.error) setError(result.error);
    else {
      setRefusing(false);
      setDelivering(false);
      router.refresh();
    }
  }

  async function submitDelivered() {
    if (proofFile && proofFile.size > MAX_FILE_SIZE) {
      setError(`${proofFile.name} dépasse 5 Mo.`);
      return;
    }
    const uid = auth.currentUser?.uid;
    if (proofFile && !uid) {
      setError(
        "Session expirée : déconnectez-vous puis reconnectez-vous pour envoyer la photo.",
      );
      return;
    }

    await run(async () => {
      let proofPhotoPath: string | undefined;
      if (proofFile && uid) {
        const safeName = proofFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        proofPhotoPath = `proofs/${uid}/${deliveryId}-${Date.now()}-${safeName}`;
        try {
          await uploadBytes(ref(storage, proofPhotoPath), proofFile, {
            contentType: proofFile.type,
          });
        } catch {
          return { error: "L'envoi de la photo a échoué. Réessayez." };
        }
      }
      return markDelivered(deliveryId, {
        recipientName,
        proofPhotoPath,
      });
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-white/[0.06] pt-3">
      <FormError message={error} />

      {delivering ? (
        <div className="flex flex-col gap-3">
          <FormField label="Nom de la personne qui a reçu le colis" htmlFor={`recipient-${deliveryId}`}>
            <Input
              id={`recipient-${deliveryId}`}
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Nom du destinataire ou de son représentant"
              required
            />
          </FormField>
          <FormField
            label="Photo du colis remis (recommandée - preuve en cas de litige)"
            htmlFor={`proof-${deliveryId}`}
          >
            <input
              id={`proof-${deliveryId}`}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-muted file:mr-4 file:rounded-sm file:border-0 file:bg-emerald/20 file:px-3 file:py-1 file:text-emerald"
            />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" disabled={loading} onClick={submitDelivered}>
              {loading ? "Enregistrement…" : "Confirmer la remise"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDelivering(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : refusing ? (
        <div className="flex flex-col items-end gap-2">
          <Input
            value={refusalReason}
            onChange={(e) => setRefusalReason(e.target.value)}
            placeholder="Motif du refus (optionnel, visible par le vendeur)"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="danger"
              disabled={loading}
              onClick={() => run(() => refuseDelivery(deliveryId, refusalReason))}
            >
              Confirmer le refus
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRefusing(false)}>
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          {status === "proposed" ? (
            <>
              <Button
                size="sm"
                disabled={loading}
                onClick={() => run(() => acceptDelivery(deliveryId))}
              >
                {loading ? "…" : "Accepter la course"}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => setRefusing(true)}
              >
                Refuser
              </Button>
            </>
          ) : null}

          {status === "accepted" ? (
            <>
              <Button
                size="sm"
                disabled={loading}
                onClick={() => run(() => markPickedUp(deliveryId))}
              >
                {loading ? "…" : "J'ai récupéré le colis"}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={loading}
                onClick={() => setRefusing(true)}
              >
                Refuser la course
              </Button>
            </>
          ) : null}

          {status === "picked_up" ? (
            <Button size="sm" disabled={loading} onClick={() => setDelivering(true)}>
              Colis remis au destinataire
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

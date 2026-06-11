"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { deleteMyAccount } from "@/app/compte/actions";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase/client";

const CONFIRMATION_WORD = "SUPPRIMER";

export function DeleteAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setError(null);
    setLoading(true);
    const result = await deleteMyAccount();
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    // Nettoie la session Firebase côté navigateur (le compte n'existe plus).
    await signOut(auth).catch(() => {});
    router.push("/");
    router.refresh();
  }

  return (
    <Card className="border-danger/30">
      <h2 className="font-display text-xl font-bold text-danger">
        Zone dangereuse
      </h2>
      <p className="mt-1 mb-4 text-sm text-ink-muted">
        La suppression de votre compte est définitive : vos adresses et
        casquettes sont effacées, et votre email/numéro pourront être
        réutilisés. Une trace anonyme est conservée pour nos obligations
        légales.
      </p>
      {open ? (
        <div className="flex flex-col gap-4">
          <FormError message={error} />
          <label
            htmlFor="deleteConfirm"
            className="text-sm text-ink-muted"
          >
            Tapez <span className="font-bold text-danger">{CONFIRMATION_WORD}</span>{" "}
            pour confirmer :
          </label>
          <Input
            id="deleteConfirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={CONFIRMATION_WORD}
          />
          <div className="flex gap-3">
            <Button
              variant="danger"
              disabled={confirmation !== CONFIRMATION_WORD || loading}
              onClick={handleDelete}
            >
              {loading ? "Suppression…" : "Supprimer définitivement"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="danger" onClick={() => setOpen(true)}>
          Supprimer mon compte
        </Button>
      )}
    </Card>
  );
}

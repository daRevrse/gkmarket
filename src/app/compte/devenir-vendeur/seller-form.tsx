"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ref, uploadBytes } from "firebase/storage";
import { submitSellerApplication } from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth, storage } from "@/lib/firebase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

async function uploadDocument(uid: string, kind: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `kyc/${uid}/${kind}-${Date.now()}-${safeName}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return path;
}

export function SellerForm({
  rejectionReason,
}: {
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [city, setCity] = useState("Lomé");
  const [district, setDistrict] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [rccm, setRccm] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [rccmFile, setRccmFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!firebaseUser) {
      setError(
        "Session expirée : déconnectez-vous puis reconnectez-vous avant d'envoyer vos documents.",
      );
      return;
    }
    if (!idFile) {
      setError("La pièce d'identité est requise.");
      return;
    }
    for (const file of [idFile, rccmFile]) {
      if (file && file.size > MAX_FILE_SIZE) {
        setError(`${file.name} dépasse 5 Mo.`);
        return;
      }
    }

    setLoading(true);
    try {
      const idDocumentPath = await uploadDocument(
        firebaseUser.uid,
        "piece-identite",
        idFile,
      );
      const rccmDocumentPath = rccmFile
        ? await uploadDocument(firebaseUser.uid, "rccm", rccmFile)
        : undefined;

      const result = await submitSellerApplication({
        shopName,
        shopDescription,
        city,
        district,
        contactPhone,
        rccm,
        idDocumentPath,
        rccmDocumentPath,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("L'envoi des documents a échoué. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {rejectionReason ? (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          Votre précédente demande a été refusée :{" "}
          <span className="font-medium">{rejectionReason}</span>. Vous pouvez
          la corriger et la soumettre à nouveau.
        </p>
      ) : null}
      <FormError message={error} />
      {authReady && !firebaseUser ? (
        <p className="rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          Pour envoyer vos documents, déconnectez-vous puis reconnectez-vous.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Nom de la boutique" htmlFor="shopName">
          <Input
            id="shopName"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Chez Mensah Électronique"
            required
          />
        </FormField>
        <FormField label="Téléphone de la boutique (optionnel)" htmlFor="contactPhone">
          <Input
            id="contactPhone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+228 90 12 34 56"
          />
        </FormField>
        <FormField label="Ville" htmlFor="city">
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </FormField>
        <FormField label="Quartier" htmlFor="district">
          <Input
            id="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="Bè, Tokoin, Agoè…"
          />
        </FormField>
      </div>

      <FormField label="Description de la boutique" htmlFor="shopDescription">
        <Input
          id="shopDescription"
          value={shopDescription}
          onChange={(e) => setShopDescription(e.target.value)}
          placeholder="Que vendez-vous ?"
        />
      </FormField>

      <FormField label="N° RCCM (optionnel - commerce formel)" htmlFor="rccm">
        <Input
          id="rccm"
          value={rccm}
          onChange={(e) => setRccm(e.target.value)}
          placeholder="TG-LOM-2024-A-1234"
        />
      </FormField>

      <FormField label="Pièce d'identité (CNI ou passeport)" htmlFor="idFile">
        <input
          id="idFile"
          type="file"
          accept={ACCEPTED}
          onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-muted file:mr-4 file:rounded-sm file:border-0 file:bg-emerald/20 file:px-3 file:py-1 file:text-emerald"
          required
        />
      </FormField>

      <FormField
        label="Document RCCM (optionnel)"
        htmlFor="rccmFile"
      >
        <input
          id="rccmFile"
          type="file"
          accept={ACCEPTED}
          onChange={(e) => setRccmFile(e.target.files?.[0] ?? null)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink-muted file:mr-4 file:rounded-sm file:border-0 file:bg-emerald/20 file:px-3 file:py-1 file:text-emerald"
        />
      </FormField>

      <p className="text-xs text-ink-muted">
        Formats acceptés : JPG, PNG, WebP, PDF - 5 Mo max. Vos documents sont
        privés et consultés uniquement par notre équipe de validation.
      </p>

      <Button type="submit" disabled={loading} className="mt-2 self-start">
        {loading ? "Envoi en cours…" : "Soumettre ma demande"}
      </Button>
    </form>
  );
}

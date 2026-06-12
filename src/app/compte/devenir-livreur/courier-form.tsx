"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ref, uploadBytes } from "firebase/storage";
import { submitCourierApplication } from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vehicleTypeLabels } from "@/lib/deliveries";
import { auth, storage } from "@/lib/firebase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED = "image/jpeg,image/png,image/webp,application/pdf";

async function uploadDocument(uid: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `kyc/${uid}/piece-identite-livreur-${Date.now()}-${safeName}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return path;
}

export function CourierForm({
  rejectionReason,
}: {
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [vehicleType, setVehicleType] = useState("moto");
  const [city, setCity] = useState("Lomé");
  const [district, setDistrict] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
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
    if (idFile.size > MAX_FILE_SIZE) {
      setError(`${idFile.name} dépasse 5 Mo.`);
      return;
    }

    setLoading(true);
    try {
      const idDocumentPath = await uploadDocument(firebaseUser.uid, idFile);

      const result = await submitCourierApplication({
        vehicleType,
        city,
        district,
        serviceArea,
        contactPhone,
        idDocumentPath,
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
        <FormField label="Moyen de transport" htmlFor="vehicleType">
          <select
            id="vehicleType"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            required
            className="w-full rounded-md border border-white/10 bg-navy-deep px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
          >
            {Object.entries(vehicleTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Téléphone de contact (optionnel)" htmlFor="contactPhone">
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

      <FormField
        label="Zones desservies (quartiers où vous livrez)"
        htmlFor="serviceArea"
      >
        <Input
          id="serviceArea"
          value={serviceArea}
          onChange={(e) => setServiceArea(e.target.value)}
          placeholder="Bè, Tokoin, Agoè, Adidogomé…"
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

      <p className="text-xs text-ink-muted">
        Formats acceptés : JPG, PNG, WebP, PDF — 5 Mo max. Vos documents sont
        privés et consultés uniquement par notre équipe de validation.
      </p>

      <Button type="submit" disabled={loading} className="mt-2 self-start">
        {loading ? "Envoi en cours…" : "Soumettre ma demande"}
      </Button>
    </form>
  );
}

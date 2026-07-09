"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
  type AddressInput,
} from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type AddressRow = {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  city: string;
  district: string | null;
  details: string | null;
  isDefault: boolean;
};

function AddressForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial?: AddressRow;
  onSubmit: (input: AddressInput) => Promise<{ error?: string }>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [recipientName, setRecipientName] = useState(
    initial?.recipientName ?? "",
  );
  const [recipientPhone, setRecipientPhone] = useState(
    initial?.recipientPhone ?? "",
  );
  const [city, setCity] = useState(initial?.city ?? "Lomé");
  const [district, setDistrict] = useState(initial?.district ?? "");
  const [details, setDetails] = useState(initial?.details ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await onSubmit({
      label,
      recipientName,
      recipientPhone,
      city,
      district,
      details,
    });
    setLoading(false);
    if (result.error) setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError message={error} />
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Libellé (optionnel)" htmlFor="label">
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Maison, Bureau…"
          />
        </FormField>
        <FormField label="Nom du destinataire" htmlFor="recipientName">
          <Input
            id="recipientName"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Kossi Mensah"
            required
          />
        </FormField>
        <FormField label="Téléphone du destinataire" htmlFor="recipientPhone">
          <Input
            id="recipientPhone"
            type="tel"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            placeholder="+228 90 12 34 56"
            required
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
        <FormField label="Précisions" htmlFor="details">
          <Input
            id="details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Repère, n° de rue, étage…"
          />
        </FormField>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

export function AddressManager({ initialAddresses }: { initialAddresses: AddressRow[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <FormError message={actionError} />

      {initialAddresses.length === 0 && !adding ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Vous n&apos;avez pas encore d&apos;adresse de livraison.
          </p>
          <Button className="mt-4" onClick={() => setAdding(true)}>
            Ajouter ma première adresse
          </Button>
        </Card>
      ) : null}

      {initialAddresses.map((address) =>
        editingId === address.id ? (
          <Card key={address.id}>
            <h2 className="mb-4 font-display text-lg font-bold">
              Modifier l&apos;adresse
            </h2>
            <AddressForm
              initial={address}
              submitLabel="Enregistrer"
              onCancel={() => setEditingId(null)}
              onSubmit={async (input) => {
                const result = await updateAddress(address.id, input);
                if (!result.error) {
                  setEditingId(null);
                  await refresh();
                }
                return result;
              }}
            />
          </Card>
        ) : (
          <Card key={address.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-bold">
                    {address.label || "Adresse"}
                  </h2>
                  {address.isDefault ? (
                    <Badge variant="verified">Par défaut</Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm">
                  {address.recipientName} -{" "}
                  <span className="text-ink-muted">
                    {address.recipientPhone}
                  </span>
                </p>
                <p className="text-sm text-ink-muted">
                  {[address.city, address.district, address.details]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!address.isDefault ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      setActionError(null);
                      const result = await setDefaultAddress(address.id);
                      if (result.error) setActionError(result.error);
                      else await refresh();
                    }}
                  >
                    Définir par défaut
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setAdding(false);
                    setEditingId(address.id);
                  }}
                >
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger hover:text-danger"
                  onClick={async () => {
                    setActionError(null);
                    const result = await deleteAddress(address.id);
                    if (result.error) setActionError(result.error);
                    else await refresh();
                  }}
                >
                  Supprimer
                </Button>
              </div>
            </div>
          </Card>
        ),
      )}

      {adding ? (
        <Card>
          <h2 className="mb-4 font-display text-lg font-bold">
            Nouvelle adresse
          </h2>
          <AddressForm
            submitLabel="Ajouter l'adresse"
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              const result = await createAddress(input);
              if (!result.error) {
                setAdding(false);
                await refresh();
              }
              return result;
            }}
          />
        </Card>
      ) : initialAddresses.length > 0 ? (
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              setEditingId(null);
              setAdding(true);
            }}
          >
            + Ajouter une adresse
          </Button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createOrder } from "./actions";
import { FormError } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type CheckoutAddress = {
  id: string;
  label: string | null;
  recipientName: string;
  recipientPhone: string;
  city: string;
  district: string | null;
  isDefault: boolean;
};

const paymentMethods = [
  { id: "mobile-money", label: "Mobile Money (Flooz, Tmoney, MTN, Moov)" },
  { id: "card", label: "Carte bancaire (Visa, Mastercard)" },
  { id: "wallet", label: "Wallet GK Market" },
];

export function CheckoutForm({ addresses }: { addresses: CheckoutAddress[] }) {
  const router = useRouter();
  const [addressId, setAddressId] = useState(
    addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "",
  );
  const [cgvAccepted, setCgvAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!addressId) {
      setError("Choisissez une adresse de livraison.");
      return;
    }
    setLoading(true);
    const result = await createOrder(addressId);
    if (result.error || !result.groupId) {
      setError(result.error ?? "La commande a échoué.");
      setLoading(false);
      return;
    }
    router.push(`/compte/commandes?nouveau=${result.groupId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError message={error} />

      <Card>
        <h2 className="font-display text-lg font-bold">Adresse de livraison</h2>
        {addresses.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">
            Vous n&apos;avez pas encore d&apos;adresse.{" "}
            <Link
              href="/compte/adresses?retour=/commande"
              className="text-emerald hover:underline"
            >
              Ajouter une adresse →
            </Link>
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {addresses.map((address) => (
              <label
                key={address.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors",
                  addressId === address.id
                    ? "border-emerald bg-emerald/5"
                    : "border-white/10 hover:border-white/25",
                )}
              >
                <input
                  type="radio"
                  name="address"
                  checked={addressId === address.id}
                  onChange={() => setAddressId(address.id)}
                  className="mt-1 accent-emerald"
                />
                <span className="text-sm">
                  <span className="font-medium">
                    {address.label || "Adresse"}
                  </span>{" "}
                  — {address.recipientName}, {address.recipientPhone}
                  <span className="block text-ink-muted">
                    {[address.city, address.district].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            ))}
            <Link
              href="/compte/adresses?retour=/commande"
              className="text-sm text-emerald hover:underline"
            >
              + Ajouter une autre adresse
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg font-bold">Mode de paiement</h2>
        <div className="mt-4 flex flex-col gap-3">
          {paymentMethods.map((method) => (
            <label
              key={method.id}
              className="flex cursor-not-allowed items-center gap-3 rounded-md border border-white/10 p-4 opacity-50"
            >
              <input type="radio" name="payment" disabled className="accent-emerald" />
              <span className="text-sm">{method.label}</span>
              <span className="ml-auto rounded-sm bg-white/10 px-2 py-0.5 text-xs text-ink-muted">
                Bientôt
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
          Le paiement sécurisé Escrow arrive à la prochaine itération. Votre
          commande sera créée <strong>« en attente de paiement »</strong> — le
          vendeur ne la traitera qu&apos;une fois le paiement effectué.
        </p>
      </Card>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={cgvAccepted}
          onChange={(e) => setCgvAccepted(e.target.checked)}
          className="mt-0.5 accent-emerald"
          required
        />
        <span className="text-ink-muted">
          J&apos;accepte les conditions générales de vente de GK Market.
        </span>
      </label>

      <Button
        type="submit"
        size="lg"
        disabled={loading || !cgvAccepted || addresses.length === 0}
        className="self-start"
      >
        {loading ? "Création de la commande…" : "Confirmer ma commande"}
      </Button>
    </form>
  );
}

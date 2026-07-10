"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { updateProfile } from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingOverlay } from "@/components/ui/spinner";
import { auth, storage } from "@/lib/firebase/client";

const MAX_LOGO_SIZE = 3 * 1024 * 1024;

type Shop = {
  shopName: string;
  shopDescription: string;
  city: string;
  district: string;
  contactPhone: string;
  sellingConditions: string;
  payoutMethod: "" | "mobile_money" | "bank";
  mobileMoneyOperator: "" | "flooz" | "tmoney";
  mobileMoneyNumber: string;
  bankName: string;
  bankAccountName: string;
  bankIban: string;
  logoUrl: string | null;
};

export function ProfileForm({
  fullName: initialName,
  email,
  phone,
  shop: initialShop,
}: {
  fullName: string;
  email: string | null;
  phone: string | null;
  shop: Shop | null;
}) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [fullName, setFullName] = useState(initialName);
  const [shop, setShop] = useState<Shop | null>(initialShop);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialShop?.logoUrl ?? null,
  );

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  function updateShop(patch: Partial<Shop>) {
    setShop((s) => (s ? { ...s, ...patch } : s));
  }

  function onLogoChange(file: File | null) {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : (shop?.logoUrl ?? null));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setOk(false);

    if (logoFile && logoFile.size > MAX_LOGO_SIZE) {
      setError("Le logo dépasse 3 Mo.");
      return;
    }

    setLoading(true);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        if (!firebaseUser) {
          setError("Session expirée : reconnectez-vous pour changer le logo.");
          setLoading(false);
          return;
        }
        const safe = logoFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const storageRef = ref(
          storage,
          `logos/${firebaseUser.uid}/logo-${Date.now()}-${safe}`,
        );
        await uploadBytes(storageRef, logoFile, { contentType: logoFile.type });
        logoUrl = await getDownloadURL(storageRef);
      }

      const result = await updateProfile({
        fullName,
        shop: shop
          ? {
              shopName: shop.shopName,
              shopDescription: shop.shopDescription,
              city: shop.city,
              district: shop.district,
              contactPhone: shop.contactPhone,
              sellingConditions: shop.sellingConditions,
              payoutMethod: shop.payoutMethod,
              mobileMoneyOperator: shop.mobileMoneyOperator,
              mobileMoneyNumber: shop.mobileMoneyNumber,
              bankName: shop.bankName,
              bankAccountName: shop.bankAccountName,
              bankIban: shop.bankIban,
              ...(logoUrl !== undefined ? { logoUrl } : {}),
            }
          : undefined,
      });
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setOk(true);
      setLogoFile(null);
      setLoading(false);
      router.refresh();
    } catch {
      setError(
        "Le téléversement du logo a échoué (le stockage n'est peut-être pas encore activé). Réessayez plus tard.",
      );
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <FormError message={error} />
      {ok ? (
        <p className="rounded-md border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-emerald-light">
          Profil mis à jour ✓
        </p>
      ) : null}

      <Card>
        <h2 className="font-display text-lg font-bold">Informations personnelles</h2>
        <div className="mt-4 flex flex-col gap-4">
          <FormField label="Nom complet" htmlFor="fullName">
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Kossi Mensah"
              required
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Email" htmlFor="email">
              <Input id="email" value={email ?? "-"} disabled readOnly />
            </FormField>
            <FormField label="Téléphone" htmlFor="phone">
              <Input id="phone" value={phone ?? "-"} disabled readOnly />
            </FormField>
          </div>
          <p className="text-xs text-ink-muted">
            L&apos;email et le téléphone servent à la connexion et ne se
            modifient pas ici.
          </p>
        </div>
      </Card>

      {shop ? (
        <Card>
          <h2 className="font-display text-lg font-bold">Ma boutique</h2>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Logo de la boutique"
                  className="size-full object-cover"
                />
              ) : (
                <span className="flex size-full items-center justify-center font-display text-2xl font-extrabold text-ink-muted">
                  {shop.shopName.trim().charAt(0).toUpperCase() || "?"}
                </span>
              )}
              {loading && logoFile ? <LoadingOverlay /> : null}
            </div>
            <div>
              <label
                htmlFor="logo"
                className="inline-block cursor-pointer rounded-md border border-emerald px-4 py-2 font-label text-sm font-semibold text-emerald hover:bg-emerald/10"
              >
                Changer le logo
              </label>
              <input
                id="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              <p className="mt-1 text-xs text-ink-muted">JPG, PNG, WebP - 3 Mo max.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <FormField label="Nom de la boutique" htmlFor="shopName">
              <Input
                id="shopName"
                value={shop.shopName}
                onChange={(e) => updateShop({ shopName: e.target.value })}
                required
              />
            </FormField>
            <FormField label="Description" htmlFor="shopDescription">
              <Input
                id="shopDescription"
                value={shop.shopDescription}
                onChange={(e) => updateShop({ shopDescription: e.target.value })}
                placeholder="Que vendez-vous ?"
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ville" htmlFor="city">
                <Input
                  id="city"
                  value={shop.city}
                  onChange={(e) => updateShop({ city: e.target.value })}
                />
              </FormField>
              <FormField label="Quartier" htmlFor="district">
                <Input
                  id="district"
                  value={shop.district}
                  onChange={(e) => updateShop({ district: e.target.value })}
                  placeholder="Bè, Tokoin, Agoè…"
                />
              </FormField>
            </div>
            <FormField
              label="Téléphone de la boutique"
              htmlFor="contactPhone"
            >
              <Input
                id="contactPhone"
                type="tel"
                value={shop.contactPhone}
                onChange={(e) => updateShop({ contactPhone: e.target.value })}
                placeholder="+228 90 12 34 56"
              />
            </FormField>
            <FormField
              label="Conditions de vente (délais, retours, garanties)"
              htmlFor="sellingConditions"
            >
              <textarea
                id="sellingConditions"
                value={shop.sellingConditions}
                onChange={(e) =>
                  updateShop({ sellingConditions: e.target.value })
                }
                rows={4}
                placeholder="Ex. Préparation sous 48 h. Retours acceptés sous 7 jours si produit non ouvert…"
                className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Affichées publiquement sur la page de votre boutique.
              </p>
            </FormField>
          </div>
        </Card>
      ) : null}

      {shop ? (
        <Card>
          <h2 className="font-display text-lg font-bold">
            Coordonnées de versement
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Où recevoir vos gains une fois les commandes livrées. Ces
            informations restent privées (vous et notre équipe uniquement).
          </p>

          <div className="mt-4 flex flex-col gap-4">
            <FormField label="Méthode de versement" htmlFor="payoutMethod">
              <select
                id="payoutMethod"
                value={shop.payoutMethod}
                onChange={(e) =>
                  updateShop({
                    payoutMethod: e.target.value as Shop["payoutMethod"],
                  })
                }
                className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
              >
                <option value="">Non renseignée</option>
                <option value="mobile_money">Mobile Money (Flooz / T-Money)</option>
                <option value="bank">Virement bancaire (RIB / IBAN)</option>
              </select>
            </FormField>

            {shop.payoutMethod === "mobile_money" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Opérateur" htmlFor="mmOperator">
                  <select
                    id="mmOperator"
                    value={shop.mobileMoneyOperator}
                    onChange={(e) =>
                      updateShop({
                        mobileMoneyOperator: e.target
                          .value as Shop["mobileMoneyOperator"],
                      })
                    }
                    className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
                  >
                    <option value="">Choisir…</option>
                    <option value="flooz">Flooz (Moov)</option>
                    <option value="tmoney">T-Money (Yas / Togocom)</option>
                  </select>
                </FormField>
                <FormField label="Numéro Mobile Money" htmlFor="mmNumber">
                  <Input
                    id="mmNumber"
                    type="tel"
                    value={shop.mobileMoneyNumber}
                    onChange={(e) =>
                      updateShop({ mobileMoneyNumber: e.target.value })
                    }
                    placeholder="+228 90 12 34 56"
                  />
                </FormField>
              </div>
            ) : null}

            {shop.payoutMethod === "bank" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Banque" htmlFor="bankName">
                    <Input
                      id="bankName"
                      value={shop.bankName}
                      onChange={(e) => updateShop({ bankName: e.target.value })}
                      placeholder="Ecobank, Orabank…"
                    />
                  </FormField>
                  <FormField label="Titulaire du compte" htmlFor="bankAccountName">
                    <Input
                      id="bankAccountName"
                      value={shop.bankAccountName}
                      onChange={(e) =>
                        updateShop({ bankAccountName: e.target.value })
                      }
                      placeholder="Nom sur le compte"
                    />
                  </FormField>
                </div>
                <FormField label="RIB / IBAN" htmlFor="bankIban">
                  <Input
                    id="bankIban"
                    value={shop.bankIban}
                    onChange={(e) => updateShop({ bankIban: e.target.value })}
                    placeholder="TG00 0000 0000 0000 0000 0000 000"
                  />
                </FormField>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Button type="submit" loading={loading} className="self-start">
        {loading ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

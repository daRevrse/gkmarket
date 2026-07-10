"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import {
  createProduct,
  updateProduct,
  type ImageInput,
  type ProductInput,
} from "./actions";
import { FormError, FormField } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { auth, storage } from "@/lib/firebase/client";

const MIN_IMAGES = 3;
const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export type CategoryOption = {
  id: string;
  name: string;
  parentName: string;
};

export type ProductFormInitial = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string;
  originCountry: string;
  priceFcfa: number;
  wholesalePriceFcfa: number | null;
  wholesaleMinQty: number | null;
  promoPriceFcfa: number | null;
  /** Échéance promo au format « AAAA-MM-JJ » (champ date). */
  promoEndsAt: string | null;
  stock: number;
  minOrderQty: number;
  weightGrams: number | null;
  prepDelayDays: number;
  images: { path: string; url: string }[];
};

type ImageSlot =
  | { kind: "existing"; path: string; url: string }
  | { kind: "new"; file: File; preview: string };

export function ProductForm({
  categories,
  initial,
}: {
  categories: CategoryOption[];
  initial?: ProductFormInitial;
}) {
  const router = useRouter();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [originCountry, setOriginCountry] = useState(
    initial?.originCountry ?? "Togo",
  );
  const [price, setPrice] = useState(initial ? String(initial.priceFcfa) : "");
  const [wholesalePrice, setWholesalePrice] = useState(
    initial?.wholesalePriceFcfa ? String(initial.wholesalePriceFcfa) : "",
  );
  const [wholesaleQty, setWholesaleQty] = useState(
    initial?.wholesaleMinQty ? String(initial.wholesaleMinQty) : "",
  );
  const [promoPrice, setPromoPrice] = useState(
    initial?.promoPriceFcfa ? String(initial.promoPriceFcfa) : "",
  );
  const [promoEnds, setPromoEnds] = useState(initial?.promoEndsAt ?? "");
  const [stock, setStock] = useState(initial ? String(initial.stock) : "");
  const [minOrderQty, setMinOrderQty] = useState(
    initial ? String(initial.minOrderQty) : "1",
  );
  const [weight, setWeight] = useState(
    initial?.weightGrams ? String(initial.weightGrams) : "",
  );
  const [prepDelay, setPrepDelay] = useState(
    initial ? String(initial.prepDelayDays) : "1",
  );
  const [slots, setSlots] = useState<ImageSlot[]>(
    initial?.images.map((image) => ({ kind: "existing" as const, ...image })) ??
      [],
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Progression de téléversement : % par emplacement + compteur global.
  const [slotProgress, setSlotProgress] = useState<Record<number, number>>({});
  const [uploadCount, setUploadCount] = useState<{ done: number; total: number } | null>(
    null,
  );

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setError(null);
    const incoming = [...list];
    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} dépasse 5 Mo.`);
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError(`${file.name} n'est pas une image.`);
        return;
      }
    }
    setSlots((current) => {
      const next = [
        ...current,
        ...incoming.map((file) => ({
          kind: "new" as const,
          file,
          preview: URL.createObjectURL(file),
        })),
      ];
      return next.slice(0, MAX_IMAGES);
    });
  }

  function removeSlot(index: number) {
    setSlots((current) => current.filter((_, i) => i !== index));
  }

  function makeMain(index: number) {
    setSlots((current) => [
      current[index],
      ...current.filter((_, i) => i !== index),
    ]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (slots.length < MIN_IMAGES) {
      setError(`Ajoutez au moins ${MIN_IMAGES} photos (${slots.length} actuellement).`);
      return;
    }
    if (!categoryId) {
      setError("Choisissez une sous-catégorie.");
      return;
    }
    if (!firebaseUser) {
      setError("Session expirée : déconnectez-vous puis reconnectez-vous.");
      return;
    }

    setLoading(true);
    setSlotProgress({});
    const toUpload = slots.filter((s) => s.kind === "new").length;
    setUploadCount(toUpload > 0 ? { done: 0, total: toUpload } : null);
    try {
      const images: ImageInput[] = [];
      for (let index = 0; index < slots.length; index++) {
        const slot = slots[index];
        if (slot.kind === "existing") {
          images.push({ path: slot.path, url: slot.url });
          continue;
        }
        const safeName = slot.file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `products/${firebaseUser.uid}/${Date.now()}-${safeName}`;
        const task = uploadBytesResumable(ref(storage, path), slot.file, {
          contentType: slot.file.type,
        });
        // Progression réelle du transfert, remontée dans l'aperçu.
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snapshot) => {
              const pct = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
              );
              setSlotProgress((prev) => ({ ...prev, [index]: pct }));
            },
            reject,
            () => resolve(),
          );
        });
        images.push({ path, url: await getDownloadURL(task.snapshot.ref) });
        setUploadCount((prev) =>
          prev ? { ...prev, done: prev.done + 1 } : prev,
        );
      }

      const input: ProductInput = {
        title,
        description,
        categoryId,
        originCountry,
        priceFcfa: Number(price),
        wholesalePriceFcfa: wholesalePrice ? Number(wholesalePrice) : null,
        wholesaleMinQty: wholesaleQty ? Number(wholesaleQty) : null,
        promoPriceFcfa: promoPrice ? Number(promoPrice) : null,
        promoEndsAt: promoEnds || null,
        stock: Number(stock),
        minOrderQty: Number(minOrderQty) || 1,
        weightGrams: weight ? Number(weight) : null,
        prepDelayDays: Number(prepDelay) || 1,
      };

      const result = initial
        ? await updateProduct(initial.id, input, images)
        : await createProduct(input, images);

      if (result.error) {
        setError(result.error);
        setLoading(false);
        setUploadCount(null);
        return;
      }
      router.push("/vendeur/produits");
      router.refresh();
    } catch {
      setError("L'envoi a échoué. Réessayez.");
      setLoading(false);
      setUploadCount(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormError message={error} />

      <FormField label="Titre du produit" htmlFor="title">
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Smartphone Tecno Spark 20, 128 Go"
          required
        />
      </FormField>

      <FormField label="Description détaillée" htmlFor="description">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="État, caractéristiques, contenu de la boîte…"
          className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
        />
      </FormField>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Sous-catégorie" htmlFor="category">
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
            className="w-full rounded-md border border-white/10 bg-navy-deep px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
          >
            <option value="">- Choisir -</option>
            {[...new Set(categories.map((c) => c.parentName))].map((parent) => (
              <optgroup key={parent} label={parent}>
                {categories
                  .filter((c) => c.parentName === parent)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </FormField>
        <FormField label="Pays d'origine" htmlFor="origin">
          <Input
            id="origin"
            value={originCountry}
            onChange={(e) => setOriginCountry(e.target.value)}
          />
        </FormField>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <FormField label="Prix unitaire (FCFA)" htmlFor="price">
          <Input
            id="price"
            type="number"
            min={1}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="15000"
            required
          />
        </FormField>
        <FormField label="Prix de gros (FCFA, optionnel)" htmlFor="wholesalePrice">
          <Input
            id="wholesalePrice"
            type="number"
            min={1}
            value={wholesalePrice}
            onChange={(e) => setWholesalePrice(e.target.value)}
            placeholder="12000"
          />
        </FormField>
        <FormField label="Qté min. prix de gros" htmlFor="wholesaleQty">
          <Input
            id="wholesaleQty"
            type="number"
            min={2}
            value={wholesaleQty}
            onChange={(e) => setWholesaleQty(e.target.value)}
            placeholder="10"
          />
        </FormField>
      </div>

      <div className="rounded-lg border border-gold/25 bg-gold/[0.04] p-4">
        <p className="font-label text-sm font-semibold text-gold">
          Promotion (optionnelle)
        </p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Le prix promo barre le prix normal jusqu&apos;à l&apos;échéance, avec
          un badge de remise et un compte à rebours sur la fiche.
        </p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <FormField label="Prix promo (FCFA)" htmlFor="promoPrice">
            <Input
              id="promoPrice"
              type="number"
              min={1}
              value={promoPrice}
              onChange={(e) => setPromoPrice(e.target.value)}
              placeholder="12000"
            />
          </FormField>
          <FormField label="Fin de la promo" htmlFor="promoEnds">
            <input
              id="promoEnds"
              type="date"
              value={promoEnds}
              onChange={(e) => setPromoEnds(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink focus:border-emerald focus:outline-none"
            />
          </FormField>
        </div>
        {promoPrice || promoEnds ? (
          <button
            type="button"
            onClick={() => {
              setPromoPrice("");
              setPromoEnds("");
            }}
            className="mt-2 font-label text-xs text-ink-muted hover:text-danger"
          >
            Retirer la promo
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <FormField label="Stock" htmlFor="stock">
          <Input
            id="stock"
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="25"
            required
          />
        </FormField>
        <FormField label="Qté min. commande" htmlFor="minOrderQty">
          <Input
            id="minOrderQty"
            type="number"
            min={1}
            value={minOrderQty}
            onChange={(e) => setMinOrderQty(e.target.value)}
          />
        </FormField>
        <FormField label="Poids (g, optionnel)" htmlFor="weight">
          <Input
            id="weight"
            type="number"
            min={1}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="350"
          />
        </FormField>
        <FormField label="Préparation (jours)" htmlFor="prepDelay">
          <Input
            id="prepDelay"
            type="number"
            min={1}
            value={prepDelay}
            onChange={(e) => setPrepDelay(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex flex-col gap-3">
        <span className="font-label text-sm font-semibold">
          Photos ({slots.length}/{MAX_IMAGES}) - minimum {MIN_IMAGES}, la
          première est la photo principale
        </span>
        <div className="flex flex-wrap gap-3">
          {slots.map((slot, index) => (
            <div
              key={slot.kind === "existing" ? slot.path : slot.preview}
              className="relative h-28 w-28 overflow-hidden rounded-md border border-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slot.kind === "existing" ? slot.url : slot.preview}
                alt={`Photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {loading && slot.kind === "new" ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 bg-navy-deep/75 backdrop-blur-sm">
                  <Spinner className="size-5 text-gold" />
                  <span className="font-label text-xs font-semibold text-ink">
                    {slotProgress[index] ?? 0} %
                  </span>
                </div>
              ) : null}
              {index === 0 ? (
                <span className="absolute top-1 left-1 rounded-sm bg-gold px-1.5 py-0.5 text-[10px] font-bold text-navy-deep">
                  Principale
                </span>
              ) : (
                <button
                  type="button"
                  title="Définir comme principale"
                  onClick={() => makeMain(index)}
                  className="absolute top-1 left-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-gold hover:text-navy-deep"
                >
                  ★
                </button>
              )}
              <button
                type="button"
                title="Supprimer"
                onClick={() => removeSlot(index)}
                className="absolute top-1 right-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-[10px] text-white hover:bg-danger"
              >
                ✕
              </button>
            </div>
          ))}
          {slots.length < MAX_IMAGES ? (
            <label className="flex h-28 w-28 cursor-pointer items-center justify-center rounded-md border border-dashed border-white/20 text-3xl text-ink-muted hover:border-emerald hover:text-emerald">
              +
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          ) : null}
        </div>
      </div>

      {loading && uploadCount ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-label text-sm text-ink-muted">
            Téléversement des photos… {uploadCount.done}/{uploadCount.total}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-300"
              style={{
                width: `${Math.round((uploadCount.done / uploadCount.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" loading={loading}>
          {loading
            ? uploadCount
              ? "Téléversement…"
              : "Enregistrement…"
            : initial
              ? "Enregistrer les modifications"
              : "Créer le produit (brouillon)"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={loading}
          onClick={() => router.push("/vendeur/produits")}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

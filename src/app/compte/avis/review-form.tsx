"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldExclamationIcon } from "@heroicons/react/24/outline";
import { StarIcon as StarSolid } from "@heroicons/react/24/solid";
import { StarIcon as StarOutline } from "@heroicons/react/24/outline";
import { submitReview } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const textareaClass =
  "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none";

/** Sélecteur de note : cinq étoiles cliquables (et navigables au clavier). */
function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="min-w-40 text-sm text-ink-muted">{label}</span>
      <span className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((star) => {
          const Icon = star <= value ? StarSolid : StarOutline;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={star === value}
              aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
              onClick={() => onChange(star)}
              className={cn(
                "rounded transition-colors",
                star <= value ? "text-gold" : "text-ink-muted/50 hover:text-gold/70",
              )}
            >
              <Icon className="size-7" />
            </button>
          );
        })}
      </span>
    </div>
  );
}

export type ReviewableItem = {
  productId: string;
  title: string;
  imageUrl: string | null;
  /** Note déjà donnée : l'article n'est plus modifiable. */
  existing: { rating: number; comment: string | null } | null;
};

/**
 * Formulaire d'avis d'une commande livrée : une note et un commentaire par
 * article, plus trois critères sur le vendeur. Un avis est définitif.
 */
export function ReviewForm({
  orderId,
  items,
  sellerReviewed,
  shopName,
}: {
  orderId: string;
  items: ReviewableItem[];
  sellerReviewed: boolean;
  shopName: string;
}) {
  const router = useRouter();
  const pending = items.filter((item) => !item.existing);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [seller, setSeller] = useState({ communication: 0, shipping: 0, packaging: 0 });
  const [sellerComment, setSellerComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const ratedProducts = pending.filter((item) => ratings[item.productId] > 0);
  const sellerComplete =
    !sellerReviewed &&
    seller.communication > 0 &&
    seller.shipping > 0 &&
    seller.packaging > 0;
  const canSubmit = ratedProducts.length > 0 || sellerComplete;

  async function submit() {
    setError(null);
    setBlocked(false);
    setLoading(true);
    const result = await submitReview(orderId, {
      products: ratedProducts.map((item) => ({
        productId: item.productId,
        rating: ratings[item.productId],
        comment: comments[item.productId],
      })),
      seller: sellerComplete ? { ...seller, comment: sellerComment } : null,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      setBlocked(Boolean(result.blocked));
      return;
    }
    router.push("/compte/avis");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 ? (
        <div className="flex flex-col gap-4">
          {pending.map((item) => (
            <div
              key={item.productId}
              className="flex flex-col gap-3 rounded-lg border border-white/[0.06] p-4"
            >
              <div className="flex items-center gap-3">
                <span className="size-12 shrink-0 overflow-hidden rounded-md bg-white/5">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <p className="min-w-0 flex-1 truncate font-medium">{item.title}</p>
              </div>
              <RatingInput
                label="Produit conforme ?"
                value={ratings[item.productId] ?? 0}
                onChange={(rating) =>
                  setRatings((current) => ({ ...current, [item.productId]: rating }))
                }
              />
              <textarea
                value={comments[item.productId] ?? ""}
                onChange={(e) =>
                  setComments((current) => ({
                    ...current,
                    [item.productId]: e.target.value,
                  }))
                }
                rows={2}
                maxLength={1000}
                placeholder="Votre commentaire (facultatif) : qualité, conformité, délai…"
                className={textareaClass}
              />
            </div>
          ))}
        </div>
      ) : null}

      {!sellerReviewed ? (
        <div className="flex flex-col gap-3 rounded-lg border border-white/[0.06] p-4">
          <p className="font-display font-bold">Votre vendeur : {shopName}</p>
          <RatingInput
            label="Communication"
            value={seller.communication}
            onChange={(v) => setSeller((s) => ({ ...s, communication: v }))}
          />
          <RatingInput
            label="Rapidité d'expédition"
            value={seller.shipping}
            onChange={(v) => setSeller((s) => ({ ...s, shipping: v }))}
          />
          <RatingInput
            label="Emballage"
            value={seller.packaging}
            onChange={(v) => setSeller((s) => ({ ...s, packaging: v }))}
          />
          <textarea
            value={sellerComment}
            onChange={(e) => setSellerComment(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Un mot sur le vendeur (facultatif)"
            className={textareaClass}
          />
          <p className="text-xs text-ink-muted">
            Les trois notes sont nécessaires pour envoyer l&apos;avis vendeur.
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className={
            blocked
              ? "flex gap-3 rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
              : "text-sm text-danger"
          }
        >
          {blocked ? <ShieldExclamationIcon className="size-5 shrink-0" /> : null}
          <p>{error}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} loading={loading} disabled={!canSubmit}>
          Publier mon avis
        </Button>
        <p className="text-xs text-ink-muted">
          Publié sous votre nom, avec la mention « Achat vérifié ». Un avis
          envoyé ne peut plus être modifié.
        </p>
      </div>
    </div>
  );
}

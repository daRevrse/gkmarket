import { Badge } from "@/components/ui/badge";
import type { RatingSummary } from "@/lib/reviews";
import { Stars } from "./stars";

/** Prénom + initiale : on ne publie jamais le nom complet de l'acheteur. */
export function reviewerName(fullName: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Acheteur vérifié";
  const [first, ...rest] = parts;
  return rest.length > 0 ? `${first} ${rest[rest.length - 1][0]}.` : first;
}

const dateFormat: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

/** Moyenne + répartition des notes, de 5 à 1 étoile. */
export function RatingBreakdown({ summary }: { summary: RatingSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div>
        <p className="font-display text-4xl font-extrabold text-gold">
          {summary.average.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
          <span className="text-lg text-ink-muted"> / 5</span>
        </p>
        <Stars rating={summary.average} size="md" className="mt-1" />
        <p className="mt-1 font-label text-xs text-ink-muted">
          {summary.count} avis vérifié{summary.count > 1 ? "s" : ""}
        </p>
      </div>
      <div className="min-w-48 flex-1">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const n = summary.distribution[star];
          const pct = summary.count > 0 ? (n / summary.count) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-label text-ink-muted">{star} ★</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-gold"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-6 text-right text-ink-muted">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type ProductReviewRow = {
  review: {
    id: string;
    rating: number;
    comment: string | null;
    sellerReply: string | null;
    createdAt: Date;
  };
  buyerName: string | null;
  /** Date de la commande, affichée avec le badge « Achat vérifié ». */
  orderedAt?: Date | null;
};

/** Liste d'avis produits, avec la réponse éventuelle du vendeur. */
export function ProductReviewList({
  rows,
  shopName,
}: {
  rows: ProductReviewRow[];
  shopName?: string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-white/[0.04]">
      {rows.map(({ review, buyerName, orderedAt }) => (
        <li key={review.id} className="py-4 first:pt-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Stars rating={review.rating} />
            <span className="text-sm font-medium">{reviewerName(buyerName)}</span>
            <Badge variant="verified">Achat vérifié</Badge>
            <span className="font-label text-xs text-ink-muted">
              {orderedAt
                ? `acheté le ${orderedAt.toLocaleDateString("fr-FR", dateFormat)} · avis du ${review.createdAt.toLocaleDateString("fr-FR", dateFormat)}`
                : review.createdAt.toLocaleDateString("fr-FR", dateFormat)}
            </span>
          </div>
          {review.comment ? (
            <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
          ) : null}
          {review.sellerReply ? (
            <div className="mt-3 rounded-md border-l-2 border-emerald/50 bg-white/[0.03] px-3 py-2">
              <p className="font-label text-xs text-emerald">
                Réponse de {shopName ?? "la boutique"}
              </p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">
                {review.sellerReply}
              </p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export type SellerReviewRow = {
  review: {
    id: string;
    communication: number;
    shipping: number;
    packaging: number;
    comment: string | null;
    sellerReply: string | null;
    createdAt: Date;
  };
  buyerName: string | null;
};

/** Liste d'avis vendeur (communication, expédition, emballage). */
export function SellerReviewList({
  rows,
  shopName,
}: {
  rows: SellerReviewRow[];
  shopName?: string | null;
}) {
  return (
    <ul className="flex flex-col divide-y divide-white/[0.04]">
      {rows.map(({ review, buyerName }) => (
        <li key={review.id} className="py-4 first:pt-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm font-medium">{reviewerName(buyerName)}</span>
            <Badge variant="verified">Achat vérifié</Badge>
            <span className="font-label text-xs text-ink-muted">
              {review.createdAt.toLocaleDateString("fr-FR", dateFormat)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              Communication <Stars rating={review.communication} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              Expédition <Stars rating={review.shipping} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              Emballage <Stars rating={review.packaging} />
            </span>
          </div>
          {review.comment ? (
            <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
          ) : null}
          {review.sellerReply ? (
            <div className="mt-3 rounded-md border-l-2 border-emerald/50 bg-white/[0.03] px-3 py-2">
              <p className="font-label text-xs text-emerald">
                Réponse de {shopName ?? "la boutique"}
              </p>
              <p className="mt-1 text-sm whitespace-pre-line text-ink-muted">
                {review.sellerReply}
              </p>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

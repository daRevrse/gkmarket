import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productReviews, products, users } from "@/db/schema";
import { RatingSummaryLine, Stars } from "@/components/reviews/stars";
import { Card } from "@/components/ui/card";
import { requireApprovedSeller } from "@/lib/auth";
import { productPath } from "@/lib/product-url";
import { sellerReviewList, shopRating } from "@/lib/reviews";
import { ReplyForm } from "./reply-form";

/** Avis reçus par la boutique : notes, commentaires et réponses publiques. */
export default async function VendeurAvisPage() {
  const user = await requireApprovedSeller();
  const sellerId = user.sellerProfile.id;

  const [rating, productRows, sellerRows] = await Promise.all([
    shopRating(sellerId),
    db
      .select({
        review: productReviews,
        productTitle: products.title,
        buyerName: users.fullName,
      })
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .innerJoin(users, eq(users.id, productReviews.buyerId))
      .where(eq(productReviews.sellerId, sellerId))
      .orderBy(desc(productReviews.createdAt))
      .limit(50),
    sellerReviewList(sellerId, 50),
  ]);

  const satisfaction =
    rating.products.count > 0
      ? (rating.products.distribution[4] + rating.products.distribution[5]) /
        rating.products.count
      : null;

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Avis reçus</h1>
        <p className="mt-1 text-ink-muted">
          Seuls les acheteurs ayant reçu leur commande peuvent noter. Une
          réponse courtoise à un avis mitigé rassure les futurs clients.
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Note globale",
            value:
              rating.average > 0
                ? rating.average.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
                : "-",
          },
          { label: "Avis produits", value: String(rating.productCount) },
          { label: "Avis vendeur", value: String(rating.sellerCount) },
          {
            label: "Satisfaction (4-5 étoiles)",
            value: satisfaction === null ? "-" : `${Math.round(satisfaction * 100)} %`,
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <p className="font-label text-xs text-ink-muted">{kpi.label}</p>
            <p className="mt-1 font-display text-xl font-extrabold text-gold">
              {kpi.value}
            </p>
          </Card>
        ))}
      </div>

      {rating.sellerCount > 0 ? (
        <Card className="mb-8">
          <h2 className="font-display text-lg font-bold">Vos points forts</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {[
              { label: "Communication", value: rating.communication },
              { label: "Rapidité d'expédition", value: rating.shipping },
              { label: "Emballage", value: rating.packaging },
            ].map((criterion) => (
              <li key={criterion.label} className="flex items-center justify-between gap-3">
                <span className="text-ink-muted">{criterion.label}</span>
                <RatingSummaryLine
                  average={criterion.value}
                  count={rating.sellerCount}
                />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">Avis sur vos produits</h2>
        {productRows.length === 0 ? (
          <Card className="text-center">
            <p className="text-ink-muted">Pas encore d&apos;avis produit.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {productRows.map(({ review, productTitle, buyerName }) => (
              <Card key={review.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={productPath({ id: review.productId, title: productTitle })}
                    className="font-medium hover:text-emerald"
                  >
                    {productTitle}
                  </Link>
                  <Stars rating={review.rating} />
                </div>
                <p className="mt-1 font-label text-xs text-ink-muted">
                  {`${buyerName ?? "Acheteur"} · ${review.createdAt.toLocaleDateString("fr-FR")}`}
                  {review.hiddenAt ? " · masqué par la modération" : ""}
                </p>
                {review.comment ? (
                  <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
                ) : null}
                {review.sellerReply ? (
                  <div className="mt-3 rounded-md border-l-2 border-emerald/50 bg-white/[0.03] p-3 text-sm">
                    <p className="font-label text-xs text-emerald">Votre réponse</p>
                    <p className="mt-1 whitespace-pre-line">{review.sellerReply}</p>
                  </div>
                ) : (
                  <ReplyForm kind="product" reviewId={review.id} />
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Avis sur votre service</h2>
        {sellerRows.length === 0 ? (
          <Card className="text-center">
            <p className="text-ink-muted">Pas encore d&apos;avis vendeur.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {sellerRows.map(({ review, buyerName }) => (
              <Card key={review.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{buyerName ?? "Acheteur"}</span>
                  <span className="flex flex-wrap gap-4 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      Communication <Stars rating={review.communication} />
                    </span>
                    <span className="inline-flex items-center gap-1">
                      Expédition <Stars rating={review.shipping} />
                    </span>
                    <span className="inline-flex items-center gap-1">
                      Emballage <Stars rating={review.packaging} />
                    </span>
                  </span>
                </div>
                <p className="mt-1 font-label text-xs text-ink-muted">
                  {review.createdAt.toLocaleDateString("fr-FR")}
                </p>
                {review.comment ? (
                  <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
                ) : null}
                {review.sellerReply ? (
                  <div className="mt-3 rounded-md border-l-2 border-emerald/50 bg-white/[0.03] p-3 text-sm">
                    <p className="font-label text-xs text-emerald">Votre réponse</p>
                    <p className="mt-1 whitespace-pre-line">{review.sellerReply}</p>
                  </div>
                ) : (
                  <ReplyForm kind="seller" reviewId={review.id} />
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

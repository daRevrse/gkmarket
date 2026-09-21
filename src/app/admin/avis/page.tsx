import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  productReviews,
  products,
  sellerProfiles,
  sellerReviews,
  users,
} from "@/db/schema";
import { Stars } from "@/components/reviews/stars";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { productPath } from "@/lib/product-url";
import { ReviewModeration } from "./moderation-actions";

/** Modération des avis : masquer un avis abusif, le réafficher si besoin. */
export default async function AdminAvisPage() {
  const [productRows, sellerRows] = await Promise.all([
    db
      .select({
        review: productReviews,
        productTitle: products.title,
        shopName: sellerProfiles.shopName,
        buyerName: users.fullName,
      })
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, productReviews.sellerId))
      .innerJoin(users, eq(users.id, productReviews.buyerId))
      .orderBy(desc(productReviews.createdAt))
      .limit(50),
    db
      .select({
        review: sellerReviews,
        shopName: sellerProfiles.shopName,
        buyerName: users.fullName,
      })
      .from(sellerReviews)
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, sellerReviews.sellerId))
      .innerJoin(users, eq(users.id, sellerReviews.buyerId))
      .orderBy(desc(sellerReviews.createdAt))
      .limit(50),
  ]);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Avis</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Les 50 derniers avis produits et vendeurs. Un avis masqué disparaît
          des fiches, des boutiques et des moyennes, sans être supprimé.
        </p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">Avis produits</h2>
        {productRows.length === 0 ? (
          <Card className="text-center">
            <p className="text-ink-muted">Aucun avis produit.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {productRows.map(({ review, productTitle, shopName, buyerName }) => (
              <Card key={review.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={productPath({ id: review.productId, title: productTitle })}
                        className="font-medium hover:text-emerald"
                      >
                        {productTitle}
                      </Link>
                      <Stars rating={review.rating} />
                      {review.hiddenAt ? (
                        <Badge variant="neutral">Masqué</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-label text-xs text-ink-muted">
                      {`${buyerName ?? "Acheteur"} · ${shopName} · ${review.createdAt.toLocaleDateString("fr-FR")}`}
                    </p>
                    {review.comment ? (
                      <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
                    ) : null}
                    {review.sellerReply ? (
                      <p className="mt-2 text-sm text-ink-muted">
                        Réponse : {review.sellerReply}
                      </p>
                    ) : null}
                  </div>
                  <ReviewModeration
                    kind="product"
                    reviewId={review.id}
                    hidden={review.hiddenAt !== null}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Avis vendeurs</h2>
        {sellerRows.length === 0 ? (
          <Card className="text-center">
            <p className="text-ink-muted">Aucun avis vendeur.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {sellerRows.map(({ review, shopName, buyerName }) => (
              <Card key={review.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{shopName}</span>
                      {review.hiddenAt ? (
                        <Badge variant="neutral">Masqué</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 font-label text-xs text-ink-muted">
                      {`${buyerName ?? "Acheteur"} · communication ${review.communication}/5 · expédition ${review.shipping}/5 · emballage ${review.packaging}/5 · ${review.createdAt.toLocaleDateString("fr-FR")}`}
                    </p>
                    {review.comment ? (
                      <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
                    ) : null}
                  </div>
                  <ReviewModeration
                    kind="seller"
                    reviewId={review.id}
                    hidden={review.hiddenAt !== null}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

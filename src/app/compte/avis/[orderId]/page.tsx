import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles } from "@/db/schema";
import { Stars } from "@/components/reviews/stars";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { reviewableOrder } from "@/lib/reviews";
import { ReviewForm } from "../review-form";

/** Dépôt de l'avis d'une commande livrée (achat vérifié). */
export default async function DonnerAvisPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { orderId } = await params;

  const reviewable = await reviewableOrder(orderId, user.id);
  if (!reviewable) notFound();
  const { order, items, sellerReview } = reviewable;

  const [shop] = await db
    .select({ shopName: sellerProfiles.shopName })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, order.sellerId))
    .limit(1);

  const alreadyReviewed = items.filter((line) => line.review);
  const nothingLeft = alreadyReviewed.length === items.length && sellerReview;

  return (
    <main className="w-full max-w-2xl flex-1">
      <div className="mb-8">
        <Link
          href="/compte/avis"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Mes avis
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Votre avis sur la commande {order.number}
        </h1>
        <p className="mt-1 text-ink-muted">
          Livrée le{" "}
          {order.deliveredAt?.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }) ?? "-"}{" "}
          · {shop?.shopName ?? "Boutique"}
        </p>
      </div>

      {alreadyReviewed.length > 0 ? (
        <Card className="mb-6">
          <h2 className="font-display text-lg font-bold">Déjà noté</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {alreadyReviewed.map(({ item, review }) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{item.title}</span>
                <Stars rating={review!.rating} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {nothingLeft ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Vous avez déjà donné votre avis sur cette commande. Merci !
          </p>
        </Card>
      ) : (
        <Card>
          <ReviewForm
            orderId={order.id}
            shopName={shop?.shopName ?? "Boutique"}
            sellerReviewed={sellerReview !== null}
            items={items.map(({ item, review }) => ({
              productId: item.productId ?? "",
              title: item.title,
              imageUrl: item.imageUrl,
              existing: review
                ? { rating: review.rating, comment: review.comment }
                : null,
            }))}
          />
        </Card>
      )}
    </main>
  );
}

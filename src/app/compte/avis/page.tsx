import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, productReviews, products, sellerProfiles } from "@/db/schema";
import { Stars } from "@/components/reviews/stars";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { productPath } from "@/lib/product-url";
import { ordersAwaitingReview } from "@/lib/reviews";

/** Avis de l'acheteur : commandes à noter et avis déjà publiés. */
export default async function MesAvisPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/compte/avis");

  const [awaiting, mine] = await Promise.all([
    ordersAwaitingReview(user.id),
    db
      .select({
        review: productReviews,
        productTitle: products.title,
        shopName: sellerProfiles.shopName,
        orderNumber: orders.number,
      })
      .from(productReviews)
      .innerJoin(products, eq(products.id, productReviews.productId))
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, productReviews.sellerId))
      .innerJoin(orders, eq(orders.id, productReviews.orderId))
      .where(eq(productReviews.buyerId, user.id))
      .orderBy(desc(productReviews.createdAt))
      .limit(50),
  ]);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Mes avis</h1>
        <p className="mt-1 text-ink-muted">
          Vous pouvez noter un produit une fois la commande reçue : votre avis
          porte alors la mention « Achat vérifié ».
        </p>
      </div>

      {awaiting.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 font-display text-xl font-bold">À noter</h2>
          <div className="flex flex-col gap-3">
            {awaiting.map((order) => (
              <Card
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-medium">Commande {order.number}</p>
                  <p className="text-sm text-ink-muted">
                    {`Livrée le ${order.deliveredAt?.toLocaleDateString("fr-FR") ?? "-"} · ${order.items - order.reviews} article${order.items - order.reviews > 1 ? "s" : ""} à noter`}
                  </p>
                </div>
                <LinkButton href={`/compte/avis/${order.id}`} size="sm">
                  Donner mon avis
                </LinkButton>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">
          Avis publiés ({mine.length})
        </h2>
        {mine.length === 0 ? (
          <Card className="text-center">
            <p className="text-ink-muted">
              Vous n&apos;avez pas encore publié d&apos;avis.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {mine.map(({ review, productTitle, shopName, orderNumber }) => (
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
                  {`${shopName} · commande ${orderNumber} · ${review.createdAt.toLocaleDateString("fr-FR")}`}
                  {review.hiddenAt ? " · masqué par la modération" : ""}
                </p>
                {review.comment ? (
                  <p className="mt-2 text-sm whitespace-pre-line">{review.comment}</p>
                ) : null}
                {review.sellerReply ? (
                  <div className="mt-3 rounded-md border-l-2 border-emerald/50 bg-white/[0.03] p-3">
                    <p className="font-label text-xs text-emerald">
                      Réponse de {shopName}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-line">
                      {review.sellerReply}
                    </p>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

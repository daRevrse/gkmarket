import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { basePriceFcfa } from "@/lib/pricing";
import { productPath } from "@/lib/product-url";
import { loadRecentlyViewed, loadWishlist } from "@/lib/shopping-list";
import { clearRecentlyViewed } from "./actions";
import { AddAllToCart, ListItemActions } from "./list-actions";

/**
 * « Ma liste » (docs/CHANGEMENTS.md §5, lot 2) : produits gardés pour plus
 * tard, avec signalement des baisses de prix, et historique « Vus récemment ».
 */
export default async function MaListePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/compte/liste");

  const [items, recent] = await Promise.all([
    loadWishlist(user.id),
    loadRecentlyViewed(user.id, 12),
  ]);

  return (
    <main className="w-full flex-1">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Ma liste</h1>
          <p className="mt-1 text-ink-muted">
            Les produits que vous gardez pour plus tard. Ajoutez-en depuis
            n&apos;importe quelle fiche avec le cœur.
          </p>
        </div>
        {items.length > 0 ? <AddAllToCart /> : null}
      </div>

      {items.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">Votre liste est vide pour le moment.</p>
          <Link
            href="/produits"
            className="mt-3 inline-block font-label text-sm text-emerald hover:underline"
          >
            Parcourir le catalogue ›
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const available =
              item.status === "published" &&
              item.shopStatus === "approved" &&
              item.stock >= item.minOrderQty &&
              item.stock > 0;
            const online =
              item.status === "published" && item.shopStatus === "approved";
            const price = basePriceFcfa(item);
            const dropped = online && price < item.priceAtAddFcfa;
            return (
              <div
                key={item.productId}
                className="flex flex-col overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03]"
              >
                <Link
                  href={productPath({ id: item.productId, title: item.title })}
                  className={online ? "block" : "pointer-events-none block opacity-60"}
                >
                  <div className="relative aspect-square overflow-hidden bg-white/5">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="size-full object-cover"
                      />
                    ) : null}
                    <span className="absolute top-2 left-2">
                      {!online ? (
                        <Badge variant="neutral">Indisponible</Badge>
                      ) : !available ? (
                        <Badge variant="neutral">Rupture</Badge>
                      ) : dropped ? (
                        <span className="rounded-full bg-emerald px-2.5 py-1 font-label text-[11px] font-bold text-navy-deep">
                          Prix en baisse
                        </span>
                      ) : null}
                    </span>
                  </div>
                </Link>
                <div className="flex flex-1 flex-col p-3">
                  <h3 className="truncate text-sm font-medium">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <p className="font-display font-bold text-gold">
                      {formatFcfa(price)}
                    </p>
                    {dropped ? (
                      <p className="text-xs text-ink-muted line-through">
                        {formatFcfa(item.priceAtAddFcfa)}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {item.shopName}
                    {item.minOrderQty > 1 ? ` · min. ${item.minOrderQty}` : ""}
                  </p>
                  <ListItemActions
                    productId={item.productId}
                    minOrderQty={item.minOrderQty}
                    available={available}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section className="pt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Vus récemment</h2>
          {recent.length > 0 ? (
            <form action={clearRecentlyViewed}>
              <button
                type="submit"
                className="font-label text-sm text-ink-muted hover:text-danger"
              >
                Effacer l&apos;historique
              </button>
            </form>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <p className="text-ink-muted">
            Les produits que vous consultez apparaîtront ici.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {recent.map((product: CatalogProduct) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

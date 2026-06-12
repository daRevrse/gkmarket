import Link from "next/link";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  const parents = await db
    .select()
    .from(categories)
    .where(isNull(categories.parentId))
    .orderBy(asc(categories.position));

  const latest = await db
    .select({
      id: products.id,
      title: products.title,
      priceFcfa: products.priceFcfa,
      wholesalePriceFcfa: products.wholesalePriceFcfa,
      stock: products.stock,
      imageUrl: productImages.url,
      shopName: sellerProfiles.shopName,
    })
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0),
      ),
    )
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    )
    .where(eq(products.status, "published"))
    .orderBy(desc(products.createdAt))
    .limit(8);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 pb-8 md:px-10">
        {/* Hero */}
        <section className="flex flex-col items-center gap-6 py-14 text-center">
          <Badge variant="wholesale">MVP — Lomé</Badge>
          <h1 className="max-w-3xl font-display text-4xl font-extrabold tracking-tight md:text-6xl">
            La marketplace <span className="text-gold">B2B</span> &{" "}
            <span className="text-emerald">B2C</span> du Togo
          </h1>
          <p className="max-w-xl text-lg text-ink-muted">
            Achetez et vendez en toute confiance : paiement sécurisé par
            Escrow, vendeurs vérifiés, livraison locale à Lomé.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <LinkButton href="/produits" size="lg">
              Explorer le catalogue
            </LinkButton>
            <LinkButton
              href={user ? "/compte/devenir-vendeur" : "/inscription"}
              size="lg"
              variant="secondary"
            >
              Devenir vendeur
            </LinkButton>
          </div>
        </section>

        {/* Catégories */}
        <section>
          <h2 className="font-display text-xl font-bold">Catégories</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {parents.map((category) => (
              <Link
                key={category.id}
                href={`/produits?categorie=${category.slug}`}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink-muted transition-colors hover:border-gold/60 hover:text-ink"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>

        {/* Nouveautés */}
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Nouveautés</h2>
            <Link
              href="/produits"
              className="text-sm text-emerald hover:underline"
            >
              Tout voir →
            </Link>
          </div>
          {latest.length === 0 ? (
            <p className="mt-6 text-ink-muted">
              Les premiers produits arrivent bientôt — les vendeurs préparent
              leurs boutiques !
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {latest.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-16 flex items-center justify-between border-t border-white/[0.04] pt-8 text-sm text-ink-muted">
          <span className="font-label">Deal Lomé</span>
          <span>GK NÉGOCES × FlowKraft Agency</span>
        </footer>
      </main>
    </div>
  );
}

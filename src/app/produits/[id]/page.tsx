import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { after } from "next/server";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { Countdown } from "@/components/countdown";
import { ProductBuyActions } from "@/components/product-buy-actions";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { publishedProducts } from "@/lib/catalog";
import { formatFcfa } from "@/lib/format";
import { basePriceFcfa, isPromoActive } from "@/lib/pricing";
import { productIdFromParam, productPath } from "@/lib/product-url";
import { productRating, productReviewList } from "@/lib/reviews";
import { isInWishlist, recordProductView } from "@/lib/shopping-list";
import {
  ProductReviewList,
  RatingBreakdown,
} from "@/components/reviews/review-list";
import { RatingSummaryLine } from "@/components/reviews/stars";
import { Gallery } from "./gallery";
import { ReportProduct } from "./report-product";

async function getPublishedProduct(param: string) {
  const id = productIdFromParam(param);
  if (!id) return null;
  const [row] = await db
    .select()
    .from(products)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  // Boutique suspendue par la modération : produits invisibles.
  if (
    !row ||
    row.products.status !== "published" ||
    row.seller_profiles.status !== "approved"
  )
    return null;
  return row;
}

// Méta-titres et descriptions dynamiques (MVP n°290, 291) + URL canonique.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: param } = await params;
  const row = await getPublishedProduct(param);
  if (!row) return { title: "Produit introuvable - Deal Lomé" };
  const product = row.products;
  const description = (product.description ?? "").replace(/\s+/g, " ").trim();
  return {
    title: `${product.title} - ${formatFcfa(basePriceFcfa(product))} | Deal Lomé`,
    description: description
      ? description.slice(0, 158)
      : `Achetez ${product.title} chez ${row.seller_profiles.shopName} sur Deal Lomé. Paiement sécurisé, livraison à Lomé.`,
    alternates: { canonical: productPath(product) },
  };
}

export default async function ProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const row = await getPublishedProduct(param);
  if (!row) notFound();

  const product = row.products;
  const seller = row.seller_profiles;
  const category = row.categories;

  // URL canonique avec slug (MVP n°289) : les anciens liens redirigent.
  const canonical = productPath(product);
  if (`/produits/${decodeURIComponent(param)}` !== canonical) {
    permanentRedirect(canonical);
  }

  const user = await getCurrentUser();
  // « Vus récemment » : enregistré après l'envoi de la page.
  if (user) after(() => recordProductView(user.id, product.id));
  const inList = user ? await isInWishlist(user.id, product.id) : false;

  const parent = category.parentId
    ? (
        await db
          .select()
          .from(categories)
          .where(eq(categories.id, category.parentId))
          .limit(1)
      )[0]
    : null;

  const images = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(asc(productImages.position));

  const inStock = product.stock > 0;
  const promo = isPromoActive(product);
  const promoPct = promo
    ? Math.round(
        ((product.priceFcfa - product.promoPriceFcfa!) / product.priceFcfa) *
          100,
      )
    : 0;

  // Autres produits de la boutique + produits du même rayon (racine).
  const rootId = parent?.id ?? category.id;
  const siblingIds = (
    await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, rootId))
  ).map((c) => c.id);
  const [sellerProducts, similarProducts, rating, reviews] = await Promise.all([
    publishedProducts()
      .where(
        and(
          eq(products.status, "published"),
          eq(products.sellerId, product.sellerId),
          ne(products.id, product.id),
        ),
      )
      .orderBy(desc(products.createdAt))
      .limit(6),
    publishedProducts()
      .where(
        and(
          eq(products.status, "published"),
          inArray(products.categoryId, [rootId, ...siblingIds]),
          ne(products.id, product.id),
        ),
      )
      .orderBy(desc(products.createdAt))
      .limit(6),
    productRating(product.id),
    productReviewList(product.id),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {/* pb-28 : place pour la barre d'actions fixe sur mobile */}
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 pt-8 pb-28 md:px-10 lg:pb-8">
        <nav className="mb-6 text-sm text-ink-muted">
          <Link href="/produits" className="hover:text-emerald">
            Catalogue
          </Link>
          {parent ? (
            <>
              {" / "}
              <Link
                href={`/produits?categorie=${parent.slug}`}
                className="hover:text-emerald"
              >
                {parent.name}
              </Link>
            </>
          ) : null}
          {" / "}
          <Link
            href={`/produits?categorie=${category.slug}`}
            className="hover:text-emerald"
          >
            {category.name}
          </Link>
        </nav>

        <div className="grid gap-8 lg:grid-cols-2">
          <Gallery images={images} title={product.title} />

          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-display text-3xl font-extrabold">
                {product.title}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                Origine : {product.originCountry}
              </p>
              <a href="#avis" className="mt-2 inline-block hover:opacity-80">
                <RatingSummaryLine
                  average={rating.average}
                  count={rating.count}
                  emptyLabel="Pas encore d'avis"
                />
              </a>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-display text-3xl font-extrabold text-gold">
                {formatFcfa(promo ? product.promoPriceFcfa! : product.priceFcfa)}
              </span>
              {promo ? (
                <>
                  <span className="text-lg text-ink-muted line-through">
                    {formatFcfa(product.priceFcfa)}
                  </span>
                  <span className="rounded-full bg-danger px-2.5 py-1 font-label text-xs font-bold text-navy-deep">
                    -{promoPct} %
                  </span>
                </>
              ) : null}
              {inStock ? (
                <Badge variant="verified">En stock ({product.stock})</Badge>
              ) : (
                <Badge variant="neutral">Rupture de stock</Badge>
              )}
            </div>
            {promo ? (
              <p className="flex items-center gap-2 text-sm text-ink-muted">
                Offre valable encore
                <Countdown endsAt={product.promoEndsAt!.toISOString()} />
              </p>
            ) : null}

            {product.wholesalePriceFcfa ? (
              <Card className="border-gold/30 p-4">
                <Badge variant="wholesale" className="mb-2">
                  Prix de gros B2B
                </Badge>
                <p className="text-sm">
                  <span className="font-display text-xl font-bold text-gold">
                    {formatFcfa(product.wholesalePriceFcfa)}
                  </span>{" "}
                  <span className="text-ink-muted">
                    / unité à partir de {product.wholesaleMinQty} unités
                  </span>
                </p>
              </Card>
            ) : null}

            <ul className="flex flex-col gap-1.5 text-sm text-ink-muted">
              {product.minOrderQty > 1 ? (
                <li>Commande minimum : {product.minOrderQty} unités</li>
              ) : null}
              {product.weightGrams ? (
                <li>
                  Poids :{" "}
                  {product.weightGrams >= 1000
                    ? `${(product.weightGrams / 1000).toLocaleString("fr-FR")} kg`
                    : `${product.weightGrams} g`}
                </li>
              ) : null}
              <li>
                Délai de préparation : {product.prepDelayDays} jour
                {product.prepDelayDays > 1 ? "s" : ""}
              </li>
            </ul>

            <ProductBuyActions
              productId={product.id}
              productPath={canonical}
              sellerId={product.sellerId}
              product={{
                priceFcfa: product.priceFcfa,
                wholesalePriceFcfa: product.wholesalePriceFcfa,
                wholesaleMinQty: product.wholesaleMinQty,
                promoPriceFcfa: product.promoPriceFcfa,
                promoEndsAt: product.promoEndsAt?.toISOString() ?? null,
              }}
              minOrderQty={product.minOrderQty}
              stock={product.stock}
              initialInList={inList}
            />

            <Card className="p-4">
              <p className="text-xs text-ink-muted">Vendu par</p>
              <div className="mt-1 flex items-center gap-2">
                <Link
                  href={`/boutique/${product.sellerId}`}
                  className="font-display font-bold hover:text-emerald"
                >
                  {seller.shopName}
                </Link>
                <Badge variant="verified">Vendeur vérifié</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {[seller.city, seller.district].filter(Boolean).join(" · ")}
              </p>
              <Link
                href={`/boutique/${product.sellerId}`}
                className="mt-2 inline-block font-label text-sm text-emerald hover:underline"
              >
                Voir la boutique ›
              </Link>
            </Card>

            <ReportProduct
              productId={product.id}
              productPath={canonical}
              isLoggedIn={user !== null}
            />

            {product.description ? (
              <div>
                <h2 className="font-display text-lg font-bold">Description</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">
                  {product.description}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Avis vérifiés : uniquement des acheteurs dont la commande est livrée */}
        <section id="avis" className="scroll-mt-24 pt-14">
          <h2 className="mb-5 font-display text-2xl font-bold">
            Avis sur ce produit
          </h2>
          {rating.count === 0 ? (
            <Card>
              <p className="text-ink-muted">
                Aucun avis pour le moment. Seuls les acheteurs ayant reçu ce
                produit peuvent le noter.
              </p>
            </Card>
          ) : (
            <Card className="flex flex-col gap-6">
              <RatingBreakdown summary={rating} />
              {reviews.length > 0 ? (
                <div className="border-t border-white/[0.06] pt-2">
                  <ProductReviewList rows={reviews} shopName={seller.shopName} />
                </div>
              ) : null}
            </Card>
          )}
        </section>

        {/* Autres produits de la boutique */}
        {sellerProducts.length > 0 ? (
          <section className="pt-14">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-bold">
                Du même vendeur - {seller.shopName}
              </h2>
              <Link
                href={`/boutique/${product.sellerId}`}
                className="font-label text-sm text-emerald hover:underline"
              >
                Toute la boutique
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {sellerProducts.map((p: CatalogProduct) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Produits du même rayon */}
        {similarProducts.length > 0 ? (
          <section className="pt-12">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-bold">
                Produits similaires
              </h2>
              <Link
                href={`/produits?categorie=${(parent ?? category).slug}`}
                className="font-label text-sm text-emerald hover:underline"
              >
                Tout le rayon
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {similarProducts.map((p: CatalogProduct) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

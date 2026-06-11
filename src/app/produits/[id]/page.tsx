import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { AddToCart } from "@/components/add-to-cart";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";
import { formatFcfa } from "@/lib/format";
import { Gallery } from "./gallery";

export default async function ProduitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [row] = await db
    .select()
    .from(products)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, id))
    .limit(1);
  if (!row || row.products.status !== "published") notFound();

  const product = row.products;
  const seller = row.seller_profiles;
  const category = row.categories;

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
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.position));

  const inStock = product.stock > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-8 md:px-10">
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
            </div>

            <div className="flex items-baseline gap-3">
              <span className="font-display text-3xl font-extrabold text-gold">
                {formatFcfa(product.priceFcfa)}
              </span>
              {inStock ? (
                <Badge variant="verified">En stock ({product.stock})</Badge>
              ) : (
                <Badge variant="neutral">Rupture de stock</Badge>
              )}
            </div>

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

            {inStock ? (
              <AddToCart
                productId={product.id}
                product={{
                  priceFcfa: product.priceFcfa,
                  wholesalePriceFcfa: product.wholesalePriceFcfa,
                  wholesaleMinQty: product.wholesaleMinQty,
                }}
                minOrderQty={product.minOrderQty}
                stock={product.stock}
              />
            ) : null}

            <Card className="p-4">
              <p className="text-xs text-ink-muted">Vendu par</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-display font-bold">{seller.shopName}</span>
                <Badge variant="verified">Vendeur vérifié</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {[seller.city, seller.district].filter(Boolean).join(" · ")}
              </p>
            </Card>

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
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, sellerProfiles } from "@/db/schema";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { publishedProducts } from "@/lib/catalog";

async function getShop(id: string) {
  const [shop] = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, id))
    .limit(1);
  // Seule une boutique approuvée est publique.
  if (!shop || shop.status !== "approved") return null;
  return shop;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const shop = await getShop(id);
  if (!shop) return { title: "Boutique introuvable - Deal Lomé" };
  return {
    title: `${shop.shopName} - Deal Lomé`,
    description:
      shop.shopDescription ??
      `Découvrez les produits de ${shop.shopName} sur Deal Lomé.`,
  };
}

export default async function BoutiquePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shop = await getShop(id);
  if (!shop) notFound();

  const items = await publishedProducts()
    .where(
      and(eq(products.status, "published"), eq(products.sellerId, shop.id)),
    )
    .orderBy(desc(products.createdAt));

  const memberSince = shop.createdAt.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-8 md:px-10">
        <header className="flex flex-wrap items-center gap-5">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.logoUrl}
                alt={shop.shopName}
                className="size-full object-cover"
              />
            ) : (
              <span className="flex size-full items-center justify-center font-display text-4xl font-extrabold text-ink-muted">
                {shop.shopName.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold">
                {shop.shopName}
              </h1>
              <Badge variant="verified">Vendeur vérifié</Badge>
            </div>
            <p className="mt-1 text-ink-muted">
              {[shop.city, shop.district].filter(Boolean).join(" · ")} · membre
              depuis {memberSince}
            </p>
            {shop.shopDescription ? (
              <p className="mt-2 max-w-2xl text-sm text-ink-muted">
                {shop.shopDescription}
              </p>
            ) : null}
          </div>
        </header>

        {shop.sellingConditions ? (
          <Card className="mt-8">
            <h2 className="font-display text-lg font-bold">
              Conditions de vente
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">
              {shop.sellingConditions}
            </p>
          </Card>
        ) : null}

        <section className="pt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">
              Produits de la boutique
            </h2>
            <span className="font-label text-sm text-ink-muted">
              {items.length} produit{items.length > 1 ? "s" : ""}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="text-ink-muted">
              Cette boutique n&apos;a pas encore de produit en ligne.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {items.map((p: CatalogProduct) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

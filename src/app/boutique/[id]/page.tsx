import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, sellerProfiles } from "@/db/schema";
import { contactSeller } from "@/app/compte/messages/actions";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import {
  ProductReviewList,
  RatingBreakdown,
  SellerReviewList,
} from "@/components/reviews/review-list";
import { RatingSummaryLine, Stars } from "@/components/reviews/stars";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { publishedProducts } from "@/lib/catalog";
import {
  productRatingSql,
  sellerReviewList,
  shopProductReviewList,
  shopRating,
  withRatings,
} from "@/lib/reviews";
import { productSearch } from "@/lib/search";
import { formatRate, shopStats } from "@/lib/shop-stats";
import { isShopTab, ShopTabs, type ShopTab } from "./shop-tabs";

async function getShop(id: string) {
  const [shop] = await db
    .select()
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, id))
    .limit(1)
    .catch(() => []);
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
    alternates: { canonical: `/boutique/${shop.id}` },
  };
}

const sortOptions = [
  { key: "recent", label: "Plus récents" },
  { key: "notes", label: "Mieux notés" },
  { key: "prix-asc", label: "Prix croissant" },
  { key: "prix-desc", label: "Prix décroissant" },
] as const;

type SortKey = (typeof sortOptions)[number]["key"];

export default async function BoutiquePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string; q?: string; tri?: string }>;
}) {
  const { id } = await params;
  const { onglet, q, tri } = await searchParams;
  const shop = await getShop(id);
  if (!shop) notFound();

  const tab: ShopTab = isShopTab(onglet) ? onglet : "accueil";
  const query = (q ?? "").trim();
  const sort: SortKey =
    sortOptions.find((option) => option.key === tri)?.key ?? "recent";

  // Recherche interne à la boutique : même moteur que le catalogue, restreint
  // au vendeur.
  const search = tab === "produits" && query ? await productSearch(query) : null;
  const orderBy =
    sort === "notes"
      ? [sql`${productRatingSql} DESC NULLS LAST`, desc(products.createdAt)]
      : sort === "prix-asc"
        ? [asc(products.priceFcfa)]
        : sort === "prix-desc"
          ? [desc(products.priceFcfa)]
          : search
            ? [desc(search.rank), desc(products.createdAt)]
            : [desc(products.createdAt)];

  const [rows, rating, stats] = await Promise.all([
    publishedProducts()
      .where(
        and(
          eq(products.status, "published"),
          eq(products.sellerId, shop.id),
          ...(search ? [search.where] : []),
        ),
      )
      .orderBy(...orderBy)
      .limit(tab === "accueil" ? 12 : 120),
    shopRating(shop.id),
    shopStats(shop.id),
  ]);
  const items = await withRatings(rows);

  const [productReviews, sellerReviews] =
    tab === "avis"
      ? await Promise.all([
          shopProductReviewList(shop.id),
          sellerReviewList(shop.id),
        ])
      : [[], []];

  const memberSince = shop.createdAt.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  // Indicateurs calculés à partir des commandes et des échanges, jamais
  // déclarés par le vendeur.
  const indicators = [
    { label: "Commandes livrées", value: String(stats.deliveredOrders) },
    {
      label: "Réponses aux messages",
      value:
        stats.responseRate === null
          ? "-"
          : stats.responseHours !== null
            ? `${formatRate(stats.responseRate)} · ${stats.responseHours.toLocaleString("fr-FR")} h`
            : formatRate(stats.responseRate),
    },
    { label: "Expédiées sous 48 h", value: formatRate(stats.fastShippingRate) },
    { label: "Clients qui recommandent", value: formatRate(stats.repeatRate) },
    { label: "Litiges", value: formatRate(stats.disputeRate) },
  ];

  const contact = contactSeller.bind(
    null,
    shop.id,
    `/boutique/${shop.id}`,
    undefined,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-8 md:px-10">
        <header className="flex flex-wrap items-start gap-5">
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
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-extrabold">
                {shop.shopName}
              </h1>
              <Badge variant="verified">Vendeur vérifié</Badge>
              {stats.isNew ? (
                <Badge variant="neutral">Nouveau vendeur</Badge>
              ) : null}
            </div>
            <Link
              href={`/boutique/${shop.id}?onglet=avis`}
              className="mt-2 inline-block hover:opacity-80"
            >
              <RatingSummaryLine
                average={rating.average}
                count={rating.productCount + rating.sellerCount}
                size="md"
                emptyLabel="Pas encore d'avis"
              />
            </Link>
            <p className="mt-1 text-ink-muted">
              {[shop.city, shop.district].filter(Boolean).join(" · ")} · membre
              depuis {memberSince}
            </p>
          </div>
          <form action={contact}>
            <Button type="submit" variant="secondary">
              Discuter avec le vendeur
            </Button>
          </form>
        </header>

        <ShopTabs shopId={shop.id} active={tab} />

        {tab === "accueil" ? (
          <div className="flex flex-col gap-8 pt-8">
            {shop.shopDescription ? (
              <Card>
                <h2 className="font-display text-lg font-bold">
                  À propos de la boutique
                </h2>
                <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-ink-muted">
                  {shop.shopDescription}
                </p>
              </Card>
            ) : null}

            <Card>
              <h2 className="font-display text-lg font-bold">
                Indicateurs de confiance
              </h2>
              {stats.isNew ? (
                <p className="mt-2 text-sm text-ink-muted">
                  Boutique récente : les indicateurs apparaîtront après quelques
                  commandes livrées.
                </p>
              ) : (
                <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {indicators.map((indicator) => (
                    <div key={indicator.label}>
                      <dt className="font-label text-xs text-ink-muted">
                        {indicator.label}
                      </dt>
                      <dd className="mt-0.5 font-display text-xl font-bold text-gold">
                        {indicator.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-4 text-xs text-ink-muted">
                Calculés automatiquement à partir des commandes et des échanges
                sur Deal Lomé.
              </p>
            </Card>

            <section>
              <div className="mb-5 flex items-end justify-between gap-4">
                <h2 className="font-display text-2xl font-bold">
                  Produits de la boutique
                </h2>
                <Link
                  href={`/boutique/${shop.id}?onglet=produits`}
                  className="font-label text-sm text-emerald hover:underline"
                >
                  Tout voir ›
                </Link>
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

            {shop.sellingConditions ? (
              <Card>
                <h2 className="font-display text-lg font-bold">
                  Conditions de vente
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">
                  {shop.sellingConditions}
                </p>
              </Card>
            ) : null}
          </div>
        ) : null}

        {tab === "produits" ? (
          <div className="pt-8">
            <form
              action={`/boutique/${shop.id}`}
              method="get"
              className="mb-6 flex flex-wrap items-center gap-3"
            >
              <input type="hidden" name="onglet" value="produits" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Rechercher dans cette boutique"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none placeholder:text-ink-muted focus:border-emerald"
              />
              <select
                name="tri"
                defaultValue={sort}
                className="rounded-md border border-white/10 bg-navy-deep px-3 py-2.5 font-label text-sm outline-none focus:border-emerald"
              >
                {sortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm">
                Filtrer
              </Button>
            </form>

            <p className="mb-4 font-label text-sm text-ink-muted">
              {items.length} produit{items.length > 1 ? "s" : ""}
              {query ? ` pour « ${query} »` : ""}
            </p>
            {items.length === 0 ? (
              <p className="text-ink-muted">
                {query
                  ? "Aucun produit de cette boutique ne correspond à votre recherche."
                  : "Cette boutique n'a pas encore de produit en ligne."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {items.map((p: CatalogProduct) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "profil" ? (
          <div className="flex flex-col gap-6 pt-8">
            <Card>
              <h2 className="font-display text-lg font-bold">
                Profil de l&apos;entreprise
              </h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="font-label text-xs text-ink-muted">
                    Raison sociale
                  </dt>
                  <dd className="mt-0.5 text-sm">{shop.shopName}</dd>
                </div>
                <div>
                  <dt className="font-label text-xs text-ink-muted">
                    Sur Deal Lomé depuis
                  </dt>
                  <dd className="mt-0.5 text-sm">{memberSince}</dd>
                </div>
                {shop.foundedYear ? (
                  <div>
                    <dt className="font-label text-xs text-ink-muted">
                      Année de création
                    </dt>
                    <dd className="mt-0.5 text-sm">{shop.foundedYear}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="font-label text-xs text-ink-muted">
                    Localisation
                  </dt>
                  <dd className="mt-0.5 text-sm">
                    {[shop.city, shop.district].filter(Boolean).join(" · ")}
                  </dd>
                </div>
                {shop.deliveryZones ? (
                  <div>
                    <dt className="font-label text-xs text-ink-muted">
                      Zones desservies
                    </dt>
                    <dd className="mt-0.5 text-sm">{shop.deliveryZones}</dd>
                  </div>
                ) : null}
                {shop.rccm ? (
                  <div>
                    <dt className="font-label text-xs text-ink-muted">RCCM</dt>
                    <dd className="mt-0.5 text-sm">{shop.rccm}</dd>
                  </div>
                ) : null}
              </dl>
              {shop.shopDescription ? (
                <p className="mt-5 max-w-3xl whitespace-pre-line text-sm text-ink-muted">
                  {shop.shopDescription}
                </p>
              ) : null}
            </Card>

            {shop.contactName ? (
              <Card>
                <h2 className="font-display text-lg font-bold">
                  Votre interlocuteur
                </h2>
                <div className="mt-4 flex items-center gap-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {shop.contactPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shop.contactPhotoUrl}
                        alt={shop.contactName}
                        className="size-full object-cover"
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center font-display text-xl font-bold text-ink-muted">
                        {shop.contactName.trim().charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{shop.contactName}</p>
                    {shop.contactRole ? (
                      <p className="text-sm text-ink-muted">{shop.contactRole}</p>
                    ) : null}
                    <form action={contact} className="mt-2">
                      <button
                        type="submit"
                        className="font-label text-sm text-emerald hover:underline"
                      >
                        Envoyer un message ›
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            ) : null}

            {shop.photos && shop.photos.length > 0 ? (
              <Card>
                <h2 className="font-display text-lg font-bold">
                  La boutique en images
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {shop.photos.map((photo) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={photo}
                      src={photo}
                      alt={`${shop.shopName} - locaux`}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              </Card>
            ) : null}

            {shop.sellingConditions ? (
              <Card>
                <h2 className="font-display text-lg font-bold">
                  Conditions de vente
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm text-ink-muted">
                  {shop.sellingConditions}
                </p>
              </Card>
            ) : null}
          </div>
        ) : null}

        {tab === "avis" ? (
          <div className="flex flex-col gap-6 pt-8">
            {rating.productCount + rating.sellerCount === 0 ? (
              <Card>
                <p className="text-ink-muted">
                  Cette boutique n&apos;a pas encore reçu d&apos;avis. Seuls les
                  acheteurs dont la commande a été livrée peuvent en laisser un.
                </p>
              </Card>
            ) : (
              <>
                <Card className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
                    <div>
                      <p className="font-label text-xs text-ink-muted">
                        Note générale
                      </p>
                      <p className="mt-1 font-display text-4xl font-extrabold text-gold">
                        {rating.average.toLocaleString("fr-FR", {
                          maximumFractionDigits: 1,
                        })}
                        <span className="text-lg text-ink-muted"> / 5</span>
                      </p>
                      <Stars rating={rating.average} size="md" className="mt-1" />
                    </div>
                    {rating.sellerCount > 0 ? (
                      <dl className="flex flex-col gap-1.5 text-sm">
                        {(
                          [
                            ["Communication", rating.communication],
                            ["Expédition", rating.shipping],
                            ["Emballage", rating.packaging],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="flex items-center gap-3">
                            <dt className="w-32 text-ink-muted">{label}</dt>
                            <dd className="flex items-center gap-2">
                              <Stars rating={value} />
                              <span className="text-ink-muted">
                                {value.toLocaleString("fr-FR", {
                                  maximumFractionDigits: 1,
                                })}
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                  {rating.products.count > 0 ? (
                    <div className="border-t border-white/[0.06] pt-5">
                      <p className="mb-3 font-label text-xs text-ink-muted">
                        Avis sur les produits
                      </p>
                      <RatingBreakdown summary={rating.products} />
                    </div>
                  ) : null}
                </Card>

                {productReviews.length > 0 ? (
                  <Card>
                    <h2 className="mb-2 font-display text-lg font-bold">
                      Derniers avis produits
                    </h2>
                    <ProductReviewList
                      rows={productReviews}
                      shopName={shop.shopName}
                    />
                  </Card>
                ) : null}

                {sellerReviews.length > 0 ? (
                  <Card>
                    <h2 className="mb-2 font-display text-lg font-bold">
                      Avis sur le vendeur
                    </h2>
                    <SellerReviewList
                      rows={sellerReviews}
                      shopName={shop.shopName}
                    />
                  </Card>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}

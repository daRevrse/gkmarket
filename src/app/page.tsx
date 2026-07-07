import Link from "next/link";
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
  HomeModernIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TrophyIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { HeroSlider, type HeroBanner } from "@/components/hero-slider";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";

/** Icône Heroicons par catégorie racine (slug). */
const CATEGORY_ICON: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  electronique: DevicePhoneMobileIcon,
  "mode-vetements": ShoppingBagIcon,
  "maison-cuisine": HomeModernIcon,
  "beaute-sante": SparklesIcon,
  alimentation: ShoppingCartIcon,
  "bebes-enfants": PuzzlePieceIcon,
  "sport-loisirs": TrophyIcon,
  "auto-moto": WrenchScrewdriverIcon,
};

const productSelection = {
  id: products.id,
  title: products.title,
  priceFcfa: products.priceFcfa,
  wholesalePriceFcfa: products.wholesalePriceFcfa,
  stock: products.stock,
  imageUrl: productImages.url,
  shopName: sellerProfiles.shopName,
};

function publishedProducts() {
  return db
    .select(productSelection)
    .from(products)
    .leftJoin(
      productImages,
      and(eq(productImages.productId, products.id), eq(productImages.position, 0)),
    )
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    );
}

export default async function Home() {
  const user = await getCurrentUser();
  const sellerHref = user ? "/compte/devenir-vendeur" : "/inscription";

  const allCategories = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.position));
  const parents = allCategories.filter((c) => !c.parentId);

  const latest = await publishedProducts()
    .where(eq(products.status, "published"))
    .orderBy(desc(products.createdAt))
    .limit(12);

  // Rayons par catégorie racine (racine + sous-catégories), affichés
  // seulement s'ils ont assez de produits pour faire un vrai rayon.
  const shelfCandidates = parents.slice(0, 4);
  const shelves = (
    await Promise.all(
      shelfCandidates.map(async (parent) => {
        const ids = [
          parent.id,
          ...allCategories.filter((c) => c.parentId === parent.id).map((c) => c.id),
        ];
        const items = await publishedProducts()
          .where(
            and(
              eq(products.status, "published"),
              inArray(products.categoryId, ids),
            ),
          )
          .orderBy(desc(products.createdAt))
          .limit(6);
        return { parent, items };
      }),
    )
  ).filter((s) => s.items.length >= 4);

  // Bannières du carrousel : un produit phare par rayon (avec photo),
  // complété par les nouveautés. Repli statique si le catalogue est vide.
  const bannerPool = [
    ...shelves.map((s) => s.items[0]),
    ...latest,
  ].filter(
    (p, i, arr) => p.imageUrl && arr.findIndex((x) => x.id === p.id) === i,
  );
  const banners: HeroBanner[] =
    bannerPool.length > 0
      ? bannerPool.slice(0, 4).map((p) => ({
          href: `/produits/${p.id}`,
          image: p.imageUrl!,
          kicker: p.shopName ?? "Deal Lomé",
          title: p.title,
          subtitle: `${formatFcfa(p.priceFcfa)} · Livraison à Lomé`,
          cta: "Voir le produit",
        }))
      : [
          {
            href: "/produits",
            image:
              "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=70",
            kicker: "Ouverture à Lomé",
            title: "Tout le marché de Lomé, livré chez vous.",
            subtitle: "Payez par TMoney ou Moov Money, en toute sécurité.",
            cta: "Voir les produits",
          },
        ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* 1. Rampe de catégories — les portes d'entrée du magasin */}
      <nav className="border-b border-white/5 bg-navy-deep/40">
        <div className="no-scrollbar mx-auto flex max-w-(--container-page) items-center gap-2 overflow-x-auto px-4 py-3 md:px-10">
          {parents.map((category) => {
            const CatIcon = CATEGORY_ICON[category.slug] ?? ShoppingBagIcon;
            return (
              <Link
                key={category.id}
                href={`/produits?categorie=${category.slug}`}
                className="flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-label text-sm whitespace-nowrap text-ink-muted transition-colors hover:bg-white/5 hover:text-gold"
              >
                <CatIcon className="size-4.5 text-gold" />
                {category.name}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 pb-16 md:px-10">
        {/* 2. Carrousel de bannières produits */}
        <div className="pt-6">
          <HeroSlider banners={banners} />
        </div>

        {/* 3. Rayon « Nouveautés » */}
        <section className="pt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-2xl font-bold">Nouveautés</h2>
            <Link
              href="/produits"
              className="inline-flex items-center gap-1 font-label text-sm text-emerald hover:underline"
            >
              Tout voir
              <ChevronRightIcon className="size-4" />
            </Link>
          </div>

          {latest.length === 0 ? (
            <div className="glass rounded-xl px-6 py-14 text-center">
              <BuildingStorefrontIcon className="mx-auto size-8 text-gold" />
              <p className="mt-4 font-display text-lg font-bold">
                Les rayons se remplissent
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
                Les premières boutiques de Lomé publient leurs produits en ce
                moment. Revenez très vite — ou prenez de l&apos;avance et ouvrez
                la vôtre.
              </p>
              <div className="mt-6">
                <LinkButton href={sellerHref} variant="secondary" size="sm">
                  Ouvrir ma boutique
                </LinkButton>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {latest.map((product: CatalogProduct) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* 4. Tuiles catégories */}
        <section className="pt-12">
          <h2 className="mb-5 font-display text-2xl font-bold">
            Parcourir les rayons
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {parents.map((category) => {
              const CatIcon = CATEGORY_ICON[category.slug] ?? ShoppingBagIcon;
              return (
                <Link
                  key={category.id}
                  href={`/produits?categorie=${category.slug}`}
                  className="glass group flex items-center gap-4 rounded-xl p-5 transition-colors hover:border-gold/40"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gold transition-colors group-hover:bg-gold/10">
                    <CatIcon className="size-6" />
                  </span>
                  <span>
                    <span className="block leading-tight font-bold">
                      {category.name}
                    </span>
                    <span className="font-label text-xs text-ink-muted">
                      Découvrir
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 5. Rayons par catégorie (si assez garnis) */}
        {shelves.map(({ parent, items }) => (
          <section key={parent.id} className="pt-12">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-bold">{parent.name}</h2>
              <Link
                href={`/produits?categorie=${parent.slug}`}
                className="inline-flex items-center gap-1 font-label text-sm text-emerald hover:underline"
              >
                Tout voir
                <ChevronRightIcon className="size-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {items.map((product: CatalogProduct) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}

        {/* 6. Bande de confiance — utilitaire, façon marketplace */}
        <section className="mt-14 grid gap-6 border-y border-white/5 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              Icon: ShieldCheckIcon,
              title: "Achats protégés",
              desc: "Commandez l'esprit tranquille.",
            },
            {
              Icon: CheckBadgeIcon,
              title: "Vendeurs vérifiés",
              desc: "Des boutiques de confiance.",
            },
            {
              Icon: BanknotesIcon,
              title: "Mobile Money",
              desc: "TMoney & Moov Money.",
            },
            {
              Icon: TruckIcon,
              title: "Livraison à Lomé",
              desc: "À domicile ou en point relais.",
            },
          ].map(({ Icon: TrustIcon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <TrustIcon className="mt-0.5 size-6 shrink-0 text-gold" />
              <div>
                <p className="font-bold">{title}</p>
                <p className="text-sm text-ink-muted">{desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* 7. Bandeau vendeur/livreur compact */}
        <section className="mt-12 flex flex-col items-center justify-between gap-6 rounded-xl border border-gold/20 bg-navy-surface p-8 text-center md:flex-row md:text-left">
          <div>
            <h2 className="font-display text-2xl font-extrabold">
              Vous vendez déjà à Lomé ?
            </h2>
            <p className="mt-1 text-ink-muted">
              Ouvrez votre boutique en ligne gratuitement — vous ne payez que 5 %
              quand vous vendez. Livreurs bienvenus aussi.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap justify-center gap-3">
            <LinkButton href={sellerHref}>Ouvrir ma boutique</LinkButton>
            <LinkButton
              href={user ? "/compte/devenir-livreur" : "/inscription"}
              variant="secondary"
            >
              Devenir livreur
            </LinkButton>
          </div>
        </section>

      </main>

    </div>
  );
}

import Link from "next/link";
import {
  BanknotesIcon,
  BuildingStorefrontIcon,
  CakeIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  CreditCardIcon,
  DevicePhoneMobileIcon,
  HomeIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SparklesIcon,
  SwatchIcon,
  TrophyIcon,
  TruckIcon,
  WalletIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

/** Icône Heroicons par catégorie racine (slug). */
const CATEGORY_ICON: Record<
  string,
  React.ComponentType<React.SVGProps<SVGSVGElement>>
> = {
  electronique: DevicePhoneMobileIcon,
  "mode-vetements": SwatchIcon,
  "maison-cuisine": HomeIcon,
  "beaute-sante": SparklesIcon,
  alimentation: CakeIcon,
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

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      {/* 1. Rampe de catégories — les portes d'entrée du magasin */}
      <nav className="border-b border-white/5 bg-navy-deep/40">
        <div className="mx-auto flex max-w-(--container-page) items-center gap-2 overflow-x-auto px-4 py-3 md:px-10">
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
        {/* 2. Zone bannières — promo consommateur + tuiles utiles */}
        <section className="grid gap-4 pt-6 lg:grid-cols-[1fr_300px]">
          <div className="glass dot-grid relative flex flex-col justify-center overflow-hidden rounded-xl p-8 md:p-12">
            <p className="font-label text-xs font-semibold tracking-widest text-emerald uppercase">
              Paiement protégé jusqu&apos;à la livraison
            </p>
            <h1 className="mt-3 max-w-lg font-display text-3xl font-extrabold leading-tight md:text-5xl">
              Tout le marché de Lomé, livré chez vous.
            </h1>
            <p className="mt-4 max-w-md text-ink-muted">
              Payez par TMoney ou Moov Money. Votre argent n&apos;est versé au
              vendeur qu&apos;une fois votre commande entre vos mains.
            </p>
            <div className="mt-6">
              <LinkButton href="/produits" size="lg">
                Voir les produits
                <ChevronRightIcon className="size-4" />
              </LinkButton>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Link
              href={sellerHref}
              className="glass group flex flex-1 items-center gap-4 rounded-xl p-5 transition-colors hover:border-gold/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
                <BuildingStorefrontIcon className="size-5" />
              </span>
              <span>
                <span className="block font-bold">Vendez sur Deal Lomé</span>
                <span className="block text-sm text-ink-muted">
                  Boutique gratuite, 5 % à la vente.
                </span>
              </span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/compte/wallet"
              className="glass group flex flex-1 items-center gap-4 rounded-xl p-5 transition-colors hover:border-emerald/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
                <WalletIcon className="size-5" />
              </span>
              <span>
                <span className="block font-bold">Mon wallet</span>
                <span className="block text-sm text-ink-muted">
                  Rechargez par Mobile Money.
                </span>
              </span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/compte/commandes"
              className="glass group flex flex-1 items-center gap-4 rounded-xl p-5 transition-colors hover:border-gold/40"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/5 text-ink-muted">
                <TruckIcon className="size-5" />
              </span>
              <span>
                <span className="block font-bold">Suivre ma commande</span>
                <span className="block text-sm text-ink-muted">
                  De la préparation à la remise.
                </span>
              </span>
              <ChevronRightIcon className="ml-auto size-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

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
              title: "Argent protégé",
              desc: "Versé au vendeur après réception confirmée.",
            },
            {
              Icon: CheckBadgeIcon,
              title: "Vendeurs vérifiés",
              desc: "Chaque boutique est validée à la main.",
            },
            {
              Icon: BanknotesIcon,
              title: "Mobile Money",
              desc: "TMoney & Moov Money, sans carte bancaire.",
            },
            {
              Icon: TruckIcon,
              title: "Livraison à Lomé",
              desc: "À domicile ou en point relais, avec preuve.",
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

        {/* 8. Questions fréquentes */}
        <section className="mx-auto max-w-3xl pt-14">
          <h2 className="mb-6 text-center font-display text-2xl font-bold">
            Questions fréquentes
          </h2>
          <div className="flex flex-col gap-3">
            {[
              [
                "Comment mon argent est-il protégé ?",
                "Quand vous payez, la somme est bloquée sur la plateforme (système Escrow) : le vendeur n'est payé que lorsque vous confirmez avoir reçu votre commande. En cas de problème, vous ouvrez un litige et un médiateur tranche — remboursement intégral ou partiel sur votre wallet.",
              ],
              [
                "Quels moyens de paiement acceptez-vous ?",
                "Vous rechargez votre wallet Deal Lomé par Mobile Money (TMoney, Moov Money) puis payez vos commandes en un clic. Aucune carte bancaire n'est nécessaire.",
              ],
              [
                "Comment devenir vendeur ?",
                "Créez un compte gratuit, remplissez la demande « Devenir vendeur » (identité et informations de boutique), et notre équipe valide votre dossier. Ouvrir sa boutique ne coûte rien : nous prenons 5 % de commission uniquement quand vous vendez.",
              ],
              [
                "Livrez-vous en dehors de Lomé ?",
                "Nous démarrons par Lomé et sa périphérie, avec livraison à domicile ou en point relais. Les autres villes du Togo suivront progressivement.",
              ],
              [
                "Que se passe-t-il si je ne reçois pas ma commande ?",
                "Tant que vous n'avez pas confirmé la réception, votre argent reste bloqué. Ouvrez un litige depuis la page de votre commande : après examen, vous êtes remboursé sur votre wallet si la livraison n'a pas eu lieu.",
              ],
            ].map(([q, a]) => (
              <details key={q} className="glass group rounded-lg">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-bold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronRightIcon className="size-4 shrink-0 text-gold transition-transform group-open:rotate-90" />
                </summary>
                <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#060f1a] px-4 pt-16 pb-10 md:px-10">
        <div className="mx-auto mb-12 grid max-w-(--container-page) grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 space-y-5 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-extrabold"
            >
              <ShoppingBagIcon className="size-6 text-gold" />
              Deal <span className="text-gold">Lomé</span>
            </Link>
            <p className="text-ink-muted">
              La marketplace des commerçants du Togo. Achetez et vendez en toute
              confiance.
            </p>
          </div>
          {[
            ["Société", ["À propos", "Carrières", "Presse", "Contact"]],
            [
              "Acheteurs",
              ["Suivi de commande", "Livraison & tarifs", "Retours", "Aide"],
            ],
            [
              "Vendeurs",
              [
                "Vendre sur Deal Lomé",
                "Portail marchand",
                "Académie vendeurs",
                "Publicité",
              ],
            ],
          ].map(([title, links]) => (
            <div key={title as string}>
              <h4 className="mb-5 font-bold">{title}</h4>
              <ul className="space-y-3 font-label text-sm text-ink-muted">
                {(links as string[]).map((l) => (
                  <li key={l}>
                    <span className="cursor-default transition-colors hover:text-gold">
                      {l}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-(--container-page) flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="font-label text-xs text-ink-muted">
            © 2026 Deal Lomé, GK NÉGOCES × FlowKraft Agency. Excellence &
            innovation au Togo.
          </p>
          <div className="flex items-center gap-4 text-ink-muted">
            <CreditCardIcon className="size-6" />
            <DevicePhoneMobileIcon className="size-6" />
            <WalletIcon className="size-6" />
          </div>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { ProductCard } from "@/components/product-card";
import { SiteHeader } from "@/components/site-header";
import { LinkButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";

/** Icône par catégorie (slug) pour les pastilles « Explorer ». */
const CATEGORY_ICON: Record<string, string> = {
  electronique: "smartphone",
  "mode-vetements": "shirt",
  "maison-cuisine": "home",
  "beaute-sante": "sparkles",
  alimentation: "basket",
  "bebes-enfants": "gift",
  "sport-loisirs": "activity",
  "auto-moto": "car",
};

export default async function Home() {
  const user = await getCurrentUser();
  const sellerHref = user ? "/compte/devenir-vendeur" : "/inscription";

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
      and(eq(productImages.productId, products.id), eq(productImages.position, 0)),
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

  const heroCards = latest.slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Bandeau de lancement */}
      <div className="flex items-center justify-center gap-2 bg-gold px-4 py-2 text-center font-label text-xs font-bold text-navy-deep">
        <Icon name="sparkles" className="size-3.5" />
        Lancement à Lomé : les premières boutiques ouvrent — la vôtre est
        gratuite.
      </div>

      <SiteHeader />

      <main className="flex-1">
        {/* 1. Hero */}
        <section className="dot-grid relative overflow-hidden px-4 py-24 md:px-10 md:py-32">
          <div className="mx-auto grid w-full max-w-(--container-page) grid-cols-1 items-center gap-12 lg:grid-cols-12">
            <div className="relative z-10 space-y-8 lg:col-span-7">
              <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
                Achetez. Vendez.
                <br />
                <span className="text-gold">Simplifiez.</span>
              </h1>

              <p className="max-w-xl text-lg text-ink-muted">
                La marketplace des commerçants du Togo. Commandez chez des
                vendeurs vérifiés, payez par Mobile Money, et faites-vous livrer
                à Lomé — votre argent reste protégé jusqu&apos;à la réception.
              </p>

              <div className="flex flex-wrap gap-4 pt-2">
                <LinkButton href="/produits" size="lg">
                  Explorer le catalogue
                </LinkButton>
                <LinkButton href={sellerHref} size="lg" variant="secondary">
                  Devenir vendeur
                  <Icon name="chevron-right" />
                </LinkButton>
              </div>
            </div>

            {/* Visuel : cartes flottantes en verre */}
            <div className="relative hidden lg:col-span-5 lg:block">
              <div className="relative mx-auto aspect-square w-full max-w-md">
                <div className="glass absolute top-8 right-0 z-30 w-60 rotate-6 rounded-2xl p-4 shadow-[var(--shadow-card)]">
                  <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-white/5 text-ink-muted">
                    {heroCards[0]?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={heroCards[0].imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon name="bag" className="size-7" />
                    )}
                  </div>
                  <p className="font-label text-[10px] text-ink-muted">Vente top</p>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-bold">
                      {heroCards[0]?.title ?? "Produit premium"}
                    </h4>
                    <span className="shrink-0 rounded bg-gold/15 px-2 py-1 text-[10px] font-bold text-gold">
                      {heroCards[0] ? formatFcfa(heroCards[0].priceFcfa) : "·"}
                    </span>
                  </div>
                </div>

                <div className="glass absolute -bottom-4 -left-6 z-20 w-60 -rotate-6 rounded-2xl p-4 shadow-[var(--shadow-card)]">
                  <div className="mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-white/5 text-ink-muted">
                    {heroCards[1]?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={heroCards[1].imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon name="package" className="size-7" />
                    )}
                  </div>
                  <p className="font-label text-[10px] text-ink-muted">Populaire</p>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-bold">
                      {heroCards[1]?.title ?? "Article tendance"}
                    </h4>
                    <span className="shrink-0 rounded bg-emerald/15 px-2 py-1 text-[10px] font-bold text-emerald">
                      {heroCards[1] ? formatFcfa(heroCards[1].priceFcfa) : "·"}
                    </span>
                  </div>
                </div>

                <div className="glass absolute inset-0 z-10 flex flex-col justify-between rounded-3xl p-6">
                  <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-bold text-emerald">
                    <Icon name="shield" className="size-3.5" />
                    Paiement Escrow
                  </span>
                  <p className="font-display text-lg font-bold text-ink-muted/70">
                    Vendeurs vérifiés, livraison locale à Lomé, fonds protégés
                    jusqu&apos;à réception.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Catégories à explorer */}
        <section className="border-y border-white/5 py-10">
          <div className="mx-auto flex max-w-(--container-page) items-center gap-4 overflow-x-auto px-4 md:px-10">
            <h3 className="shrink-0 font-display text-lg font-bold">Explorer</h3>
            <div className="flex items-center gap-3">
              {parents.map((category) => (
                <Link
                  key={category.id}
                  href={`/produits?categorie=${category.slug}`}
                  className="glass flex shrink-0 items-center gap-2 rounded-full px-5 py-3 whitespace-nowrap text-ink-muted transition-colors hover:border-gold/60 hover:bg-white/10 hover:text-ink"
                >
                  <Icon
                    name={CATEGORY_ICON[category.slug] ?? "tag"}
                    className="size-4 text-gold"
                  />
                  <span className="font-label text-sm">{category.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Produits populaires (vraies données) */}
        <section className="px-4 py-20 md:px-10">
          <div className="mx-auto max-w-(--container-page)">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl font-bold">
                  Produits populaires
                </h2>
                <p className="mt-1 text-ink-muted">
                  Les dernières trouvailles de nos vendeurs vérifiés.
                </p>
              </div>
              <Link
                href="/produits"
                className="inline-flex items-center gap-1 font-label text-sm text-emerald hover:underline"
              >
                Tout voir
                <Icon name="chevron-right" className="size-4" />
              </Link>
            </div>

            {latest.length === 0 ? (
              <div className="glass rounded-lg px-6 py-12 text-center text-ink-muted">
                Les premiers produits arrivent bientôt, les vendeurs préparent
                leurs boutiques.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {latest.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 4. Espace B2B */}
        <section className="dot-grid border-t border-white/5 bg-navy-deep/40 px-4 py-24 md:px-10">
          <div className="mx-auto grid max-w-(--container-page) grid-cols-1 items-center gap-16 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 font-bold text-emerald">
                <Icon name="briefcase" className="size-5" />
                Espace professionnel B2B
              </div>
              <h2 className="mb-8 font-display text-4xl font-extrabold leading-tight">
                Gérez vos stocks à l&apos;échelle nationale.
              </h2>
              <ul className="mb-10 space-y-6">
                {[
                  [
                    "Prix de gros négociés",
                    "Accédez à des tarifs préférentiels pour les commandes en volume.",
                  ],
                  [
                    "Logistique intégrée",
                    "Livraison sécurisée de palettes et containers dans tout le Togo.",
                  ],
                  [
                    "Facturation entreprise",
                    "Documents fiscaux conformes et facilités de paiement à 30 jours.",
                  ],
                ].map(([title, desc]) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald/15 text-emerald">
                      <Icon name="check" className="size-3.5" />
                    </span>
                    <div>
                      <h4 className="font-bold">{title}</h4>
                      <p className="text-ink-muted">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <LinkButton href={sellerHref} size="lg">
                Créer un compte business
              </LinkButton>
            </div>

            <div className="space-y-4">
              {[
                {
                  icon: "factory",
                  name: "Coopératives agricoles",
                  role: "Vendez vos récoltes en volume, au prix de gros",
                  tags: ["Paliers de prix B2B", "Commandes groupées"],
                  accent: "border-l-emerald",
                  shift: "translate-x-4",
                },
                {
                  icon: "package",
                  name: "Grossistes & importateurs",
                  role: "Écoulez vos stocks auprès des revendeurs de Lomé",
                  tags: ["Facturation entreprise", "Prix dégressifs"],
                  accent: "border-l-gold",
                  shift: "",
                },
                {
                  icon: "truck",
                  name: "Livreurs partenaires",
                  role: "Rejoignez le réseau et encaissez les frais de course",
                  tags: [],
                  accent: "border-l-emerald",
                  shift: "translate-x-8 opacity-60",
                },
              ].map((s) => (
                <div
                  key={s.name}
                  className={`glass flex items-center gap-6 rounded-2xl border-l-4 ${s.accent} ${s.shift} p-6`}
                >
                  <div className="flex size-16 items-center justify-center rounded-xl bg-white/5 text-gold">
                    <Icon name={s.icon} className="size-7" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg font-bold">{s.name}</h4>
                    <p className="text-ink-muted">{s.role}</p>
                    {s.tags.length > 0 ? (
                      <div className="mt-2 flex gap-2">
                        {s.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-white/5 px-2 py-1 text-[10px] font-bold"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Bannière vendeur */}
        <section className="px-4 py-20 md:px-10">
          <div className="mx-auto max-w-(--container-page) overflow-hidden rounded-[40px] border border-gold/20 bg-navy-surface p-10 lg:p-20">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
              <div>
                <h2 className="mb-8 font-display text-4xl font-extrabold leading-[1.05] md:text-5xl">
                  Votre boutique.
                  <br />
                  Vos règles.
                  <br />
                  <span className="text-gold">Votre succès.</span>
                </h2>
                <div className="mb-10 flex flex-wrap gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
                    <span className="block font-display text-3xl font-black text-gold">
                      0 FCFA
                    </span>
                    <span className="text-sm font-bold text-ink-muted">
                      Pour démarrer
                    </span>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
                    <span className="block font-display text-3xl font-black text-gold">
                      5 %
                    </span>
                    <span className="text-sm font-bold text-ink-muted">
                      De commission, uniquement à la vente
                    </span>
                  </div>
                </div>
                <LinkButton href={sellerHref} size="lg">
                  Ouvrir ma boutique
                  <Icon name="chevron-right" />
                </LinkButton>
              </div>
              <div className="hidden lg:block">
                <div className="glass rotate-2 rounded-3xl p-8 transition-transform hover:rotate-0">
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-12 items-center justify-center rounded-full bg-gold/15 text-gold">
                        <Icon name="bag" className="size-5" />
                      </div>
                      <div>
                        <p className="font-bold text-ink">Votre boutique</p>
                        <p className="text-xs text-gold">Vendeur vérifié</p>
                      </div>
                    </div>
                    <span className="font-label text-[10px] tracking-wider text-ink-muted uppercase">
                      Aperçu illustratif
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/5 p-4">
                      <p className="mb-1 text-xs text-ink-muted">Ventes du mois</p>
                      <p className="font-display text-2xl font-black text-ink">
                        1 240 500 FCFA
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald">
                        <Icon name="trending-up" className="size-4" />
                        +24 % ce mois
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-white/5 p-4">
                        <p className="mb-1 text-xs text-ink-muted">Commandes</p>
                        <p className="text-xl font-bold text-ink">152</p>
                      </div>
                      <div className="rounded-xl bg-white/5 p-4">
                        <p className="mb-1 text-xs text-ink-muted">Stock bas</p>
                        <p className="text-xl font-bold text-danger">3 items</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Comment ça marche */}
        <section className="px-4 py-24 text-center md:px-10">
          <div className="mx-auto max-w-(--container-page)">
            <h2 className="mb-16 font-display text-3xl font-bold">
              Comment ça marche ?
            </h2>
            <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
              {[
                [
                  "search",
                  "Recherchez",
                  "Trouvez vos articles parmi des milliers de références locales et internationales.",
                ],
                [
                  "card",
                  "Commandez",
                  "Payez en toute sécurité via Mobile Money (TMoney, Moov Money) ou par wallet.",
                ],
                [
                  "truck",
                  "Recevez",
                  "Faites-vous livrer à domicile ou en point relais en moins de 48 h partout au Togo.",
                ],
              ].map(([icon, title, desc], i) => (
                <div key={title} className="flex flex-col items-center">
                  <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl border border-gold/20 bg-white/5 text-gold">
                    <Icon name={icon} className="size-7" />
                    <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-gold font-label text-xs font-black text-navy-deep">
                      {i + 1}
                    </span>
                  </div>
                  <h4 className="mb-3 font-display text-xl font-bold">{title}</h4>
                  <p className="max-w-xs text-ink-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Nos engagements */}
        <section className="border-y border-white/5 bg-navy-deep/40 px-4 py-20 md:px-10">
          <div className="mx-auto grid max-w-(--container-page) grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "shield",
                title: "Argent protégé",
                desc: "Votre paiement est bloqué en Escrow et versé au vendeur seulement quand vous confirmez la réception.",
              },
              {
                icon: "check",
                title: "Vendeurs vérifiés",
                desc: "Chaque boutique est contrôlée à la main (identité, activité) avant d'apparaître sur le site.",
              },
              {
                icon: "wallet",
                title: "Mobile Money",
                desc: "Rechargez votre wallet par TMoney ou Moov Money — pas besoin de carte bancaire.",
              },
              {
                icon: "truck",
                title: "Livraison suivie",
                desc: "Suivez votre commande étape par étape, avec preuve de remise à la livraison.",
              },
            ].map((g) => (
              <div key={g.title} className="flex flex-col items-center text-center">
                <span className="mb-4 flex size-12 items-center justify-center rounded-xl border border-gold/20 bg-white/5 text-gold">
                  <Icon name={g.icon} className="size-5" />
                </span>
                <h3 className="mb-2 font-display text-lg font-bold">{g.title}</h3>
                <p className="max-w-xs text-sm text-ink-muted">{g.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 8. Questions fréquentes */}
        <section className="px-4 py-24 md:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="mb-12 text-center">
              <h2 className="mb-3 font-display text-3xl font-bold">
                Questions fréquentes
              </h2>
              <p className="text-ink-muted">
                Tout ce qu&apos;il faut savoir avant de commander ou de vendre.
              </p>
            </div>
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
                    <Icon
                      name="chevron-right"
                      className="size-4 shrink-0 text-gold transition-transform group-open:rotate-90"
                    />
                  </summary>
                  <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Application mobile */}
        <section className="px-4 py-24 md:px-10">
          <div className="glass mx-auto max-w-(--container-page) overflow-hidden rounded-[48px] p-10 lg:p-20">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <h2 className="mb-8 font-display text-4xl font-extrabold md:text-5xl">
                  Le Togo dans votre poche.
                </h2>
                <p className="mb-10 text-lg text-ink-muted">
                  Téléchargez l&apos;application Deal Lomé pour une expérience
                  d&apos;achat plus rapide, des notifications en temps réel et des
                  offres exclusives mobiles.
                </p>
                <div className="flex flex-wrap gap-4">
                  <span className="glass flex items-center gap-2 rounded-xl px-6 py-3 font-label text-sm font-semibold">
                    <Icon name="smartphone" className="size-5" />
                    App Store
                  </span>
                  <span className="glass flex items-center gap-2 rounded-xl px-6 py-3 font-label text-sm font-semibold">
                    <Icon name="smartphone" className="size-5" />
                    Google Play
                  </span>
                </div>
                <p className="mt-4 font-label text-xs text-ink-muted">
                  Bientôt disponible, Phase 3.
                </p>
              </div>
              <div className="relative hidden h-[420px] lg:block">
                <div className="dot-grid absolute top-0 right-4 h-[400px] w-[220px] rotate-6 overflow-hidden rounded-[36px] border-4 border-navy-surface bg-navy-deep" />
                <div className="absolute top-10 right-40 h-[400px] w-[220px] -rotate-12 overflow-hidden rounded-[36px] border-4 border-navy-surface bg-navy-deep opacity-80" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#060f1a] px-4 pt-20 pb-10 md:px-10">
        <div className="mx-auto mb-16 grid max-w-(--container-page) grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 space-y-6 md:col-span-1">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-xl font-extrabold"
            >
              <Icon name="bag" className="size-6 text-gold" />
              Deal <span className="text-gold">Lomé</span>
            </Link>
            <p className="text-ink-muted">
              La marketplace de référence au Togo. Excellence, innovation et
              accessibilité pour tous.
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
              <h4 className="mb-6 font-bold">{title}</h4>
              <ul className="space-y-4 font-label text-sm text-ink-muted">
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
            <Icon name="card" className="size-6" />
            <Icon name="smartphone" className="size-6" />
            <Icon name="wallet" className="size-6" />
          </div>
        </div>
      </footer>
    </div>
  );
}

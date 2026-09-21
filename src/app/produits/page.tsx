import Link from "next/link";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  imageSearches,
  productImages,
  products,
  sellerProfiles,
} from "@/db/schema";
import { ProductCard } from "@/components/product-card";
import { ProductSuggestions } from "@/components/product-suggestions";
import { SiteHeader } from "@/components/site-header";
import { catalogSelection } from "@/lib/catalog";
import { visualMatches } from "@/lib/image-index";
import { productRatingSql, ratedAtLeast, withRatings } from "@/lib/reviews";
import {
  productSearch,
  suggestCorrection,
  type ProductSearch,
} from "@/lib/search";
import { cn } from "@/lib/utils";
import { SearchLogger } from "./search-logger";

const PAGE_SIZE = 12;

type SearchParams = {
  q?: string;
  categorie?: string;
  prix_min?: string;
  prix_max?: string;
  en_stock?: string;
  note_min?: string;
  /** Identifiant d'une recherche par photo (lot 7). */
  image?: string;
  tri?: string;
  page?: string;
};

function buildQueryString(params: SearchParams, overrides: Partial<SearchParams>) {
  const merged = { ...params, ...overrides };
  const entries = Object.entries(merged).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  const qs = new URLSearchParams(entries as [string, string][]).toString();
  return qs ? `/produits?${qs}` : "/produits";
}

// Méta-titres dynamiques par rayon ou recherche (MVP n°290, 291).
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  let scope = "Catalogue";
  if (params.categorie) {
    const [category] = await db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.slug, params.categorie))
      .limit(1);
    if (category) scope = category.name;
  } else if (params.q?.trim()) {
    scope = `Recherche « ${params.q.trim()} »`;
  }
  return {
    title: `${scope} - Deal Lomé`,
    description: `${scope} sur Deal Lomé, la marketplace du Togo : vendeurs vérifiés, paiement sécurisé, livraison à Lomé.`,
  };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  // Arborescence des catégories pour la navigation
  const allCategories = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.position), asc(categories.name));
  const parents = allCategories.filter((c) => c.parentId === null);
  const selected = params.categorie
    ? allCategories.find((c) => c.slug === params.categorie)
    : undefined;
  const selectedParent = selected?.parentId
    ? allCategories.find((c) => c.id === selected.parentId)
    : selected;
  const subcategories = selectedParent
    ? allCategories.filter((c) => c.parentId === selectedParent.id)
    : [];

  // Filtres - seules les boutiques approuvées (non suspendues) sont visibles
  const filters: SQL[] = [
    eq(products.status, "published"),
    inArray(
      products.sellerId,
      db
        .select({ id: sellerProfiles.id })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.status, "approved")),
    ),
  ];
  if (selected) {
    if (selected.parentId === null) {
      const subIds = allCategories
        .filter((c) => c.parentId === selected.id)
        .map((c) => c.id);
      if (subIds.length > 0) filters.push(inArray(products.categoryId, subIds));
    } else {
      filters.push(eq(products.categoryId, selected.id));
    }
  }
  // Recherche par photo : on récupère d'abord les produits visuellement
  // proches, puis les filtres et la pagination habituels s'y appliquent.
  const [imageSearch] = params.image
    ? await db
        .select({
          thumbnail: imageSearches.thumbnail,
          embedding: imageSearches.embedding,
        })
        .from(imageSearches)
        .where(eq(imageSearches.id, params.image))
        .limit(1)
        .catch(() => [])
    : [];
  const visual = imageSearch ? await visualMatches(imageSearch.embedding) : null;
  if (visual) {
    filters.push(
      visual.length > 0
        ? inArray(
            products.id,
            visual.map((match) => match.productId),
          )
        : sql`false`,
    );
  }

  const prixMin = Number(params.prix_min);
  if (prixMin > 0) filters.push(gte(products.priceFcfa, prixMin));
  const prixMax = Number(params.prix_max);
  if (prixMax > 0) filters.push(lte(products.priceFcfa, prixMax));
  if (params.en_stock === "1") filters.push(gt(products.stock, 0));
  // Filtre sur la note moyenne des avis vérifiés (lot 5).
  const noteMin = Number(params.note_min);
  if (noteMin >= 1 && noteMin <= 5) filters.push(ratedAtLeast(noteMin));

  // Recherche intelligente (lot 4) : plein texte, synonymes, rayons et
  // boutiques ; sans résultat, correction des fautes de frappe.
  const countFor = async (candidate: ProductSearch | null) =>
    (
      await db
        .select({ total: count() })
        .from(products)
        .where(and(...filters, ...(candidate ? [candidate.where] : [])))
    )[0].total;
  let search = params.q?.trim() ? await productSearch(params.q) : null;
  let total = await countFor(search);
  let correctedFrom: string | null = null;
  if (search && total === 0) {
    const correction = await suggestCorrection(search.normalized);
    const corrected = correction ? await productSearch(correction) : null;
    const correctedTotal = corrected ? await countFor(corrected) : 0;
    if (corrected && correctedTotal > 0) {
      correctedFrom = search.normalized;
      search = corrected;
      total = correctedTotal;
    }
  }

  const where = and(...filters, ...(search ? [search.where] : []));
  // Tri : ressemblance sur une recherche par photo, sinon pertinence dès
  // qu'il y a une requête texte.
  const sort = params.tri || (search ? "pertinence" : visual ? "image" : "recents");
  // Ordre exact renvoyé par la recherche visuelle (du plus proche au moins).
  const visualOrder =
    visual && visual.length > 0
      ? sql`array_position(ARRAY[${sql.raw(
          visual.map((match) => `'${match.productId}'::uuid`).join(","),
        )}], ${products.id})`
      : null;
  const orderBy =
    sort === "image" && visualOrder
      ? [asc(visualOrder)]
      : sort === "prix-asc"
      ? [asc(products.priceFcfa)]
      : sort === "prix-desc"
        ? [desc(products.priceFcfa)]
        : sort === "notes"
          ? [sql`${productRatingSql} DESC NULLS LAST`, desc(products.createdAt)]
          : sort === "pertinence" && search
            ? [desc(search.rank), desc(products.createdAt)]
            : [desc(products.createdAt)];

  const rows = await db
    .select(catalogSelection)
    .from(products)
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0),
      ),
    )
    .leftJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .where(where)
    .orderBy(...orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);
  const items = await withRatings(rows);

  // Boutiques dont le nom correspond à la recherche.
  const matchingShops = search
    ? await db
        .select({ id: sellerProfiles.id, shopName: sellerProfiles.shopName })
        .from(sellerProfiles)
        .where(
          and(
            eq(sellerProfiles.status, "approved"),
            sql`public.immutable_unaccent(lower(${sellerProfiles.shopName})) LIKE ${`%${search.normalized}%`}`,
          ),
        )
        .limit(3)
    : [];


  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader query={params.q} />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-8 md:px-10">
        <h1 className="font-display text-2xl font-extrabold">
          {imageSearch
            ? "Produits ressemblant à votre photo"
            : selected
              ? selected.name
              : params.q
                ? `Résultats pour « ${params.q} »`
                : "Catalogue"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {total} produit{total > 1 ? "s" : ""}
        </p>

        {imageSearch ? (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${imageSearch.thumbnail}`}
              alt="Photo recherchée"
              className="size-20 shrink-0 rounded-md object-cover"
            />
            <div className="min-w-0">
              <p className="text-sm">
                {total > 0
                  ? "Les produits du catalogue les plus proches de cette photo, du plus ressemblant au moins ressemblant."
                  : "Aucun produit du catalogue ne ressemble à cette photo."}
              </p>
              <Link
                href="/produits"
                className="mt-1 inline-block font-label text-sm text-emerald hover:underline"
              >
                Revenir au catalogue ›
              </Link>
            </div>
          </div>
        ) : null}

        {/* Catégories principales */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={buildQueryString(params, { categorie: undefined, page: undefined })}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              !selected
                ? "border-gold bg-gold text-navy-deep font-semibold"
                : "border-white/10 text-ink-muted hover:border-gold/50 hover:text-ink",
            )}
          >
            Tout
          </Link>
          {parents.map((parent) => (
            <Link
              key={parent.id}
              href={buildQueryString(params, { categorie: parent.slug, page: undefined })}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                selectedParent?.id === parent.id
                  ? "border-gold bg-gold text-navy-deep font-semibold"
                  : "border-white/10 text-ink-muted hover:border-gold/50 hover:text-ink",
              )}
            >
              {parent.name}
            </Link>
          ))}
        </div>

        {/* Sous-catégories de la catégorie sélectionnée */}
        {subcategories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {subcategories.map((sub) => (
              <Link
                key={sub.id}
                href={buildQueryString(params, { categorie: sub.slug, page: undefined })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  selected?.id === sub.id
                    ? "border-emerald bg-emerald/15 text-emerald font-semibold"
                    : "border-white/10 text-ink-muted hover:border-emerald/50 hover:text-ink",
                )}
              >
                {sub.name}
              </Link>
            ))}
          </div>
        ) : null}

        {/* Filtres prix / stock / tri */}
        <form
          action="/produits"
          className="mt-5 flex flex-wrap items-end gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
        >
          {params.q ? <input type="hidden" name="q" value={params.q} /> : null}
          {params.categorie ? (
            <input type="hidden" name="categorie" value={params.categorie} />
          ) : null}
          {params.image ? (
            <input type="hidden" name="image" value={params.image} />
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Prix min (FCFA)
            <input
              type="number"
              name="prix_min"
              min={0}
              defaultValue={params.prix_min}
              className="w-32 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Prix max (FCFA)
            <input
              type="number"
              name="prix_max"
              min={0}
              defaultValue={params.prix_max}
              className="w-32 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 py-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              name="en_stock"
              value="1"
              defaultChecked={params.en_stock === "1"}
              className="accent-emerald"
            />
            En stock uniquement
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Note minimum
            <select
              name="note_min"
              defaultValue={params.note_min ?? ""}
              className="rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            >
              <option value="">Toutes</option>
              <option value="4">4 étoiles et plus</option>
              <option value="3">3 étoiles et plus</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Trier par
            <select
              name="tri"
              defaultValue={sort}
              className="rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            >
              {search ? <option value="pertinence">Pertinence</option> : null}
              {visual ? <option value="image">Ressemblance</option> : null}
              <option value="recents">Plus récents</option>
              <option value="notes">Mieux notés</option>
              <option value="prix-asc">Prix croissant</option>
              <option value="prix-desc">Prix décroissant</option>
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-gold-light"
          >
            Appliquer
          </button>
        </form>

        {/* Journal anonyme (tendances, recherches sans résultat). */}
        {params.q?.trim() && page === 1 ? (
          <SearchLogger query={params.q.trim()} />
        ) : null}

        {correctedFrom && search ? (
          <p className="mt-3 text-sm text-ink-muted">
            Aucun résultat pour « {correctedFrom} » : résultats pour{" "}
            <span className="font-semibold text-ink">« {search.normalized} »</span>.
          </p>
        ) : null}

        {matchingShops.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">Boutiques :</span>
            {matchingShops.map((shop) => (
              <Link
                key={shop.id}
                href={`/boutique/${shop.id}`}
                className="rounded-full border border-emerald/40 px-3 py-1 text-emerald hover:bg-emerald/10"
              >
                {shop.shopName} ›
              </Link>
            ))}
          </div>
        ) : null}

        {/* Grille produits */}
        {items.length === 0 ? (
          <>
            <p className="mt-12 text-center text-ink-muted">
              {imageSearch
                ? "Aucun produit ne ressemble à cette photo pour le moment."
                : "Aucun produit ne correspond à votre recherche."}
            </p>
            <ProductSuggestions title="Découvrez plutôt ces produits" />
          </>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-2">
            {page > 1 ? (
              <Link
                href={buildQueryString(params, { page: String(page - 1) })}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-ink-muted hover:border-gold/50 hover:text-ink"
              >
                ‹ Précédent
              </Link>
            ) : null}
            <span className="px-2 text-sm text-ink-muted">
              Page {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildQueryString(params, { page: String(page + 1) })}
                className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-ink-muted hover:border-gold/50 hover:text-ink"
              >
                Suivant ›
              </Link>
            ) : null}
          </nav>
        ) : null}
      </main>
    </div>
  );
}

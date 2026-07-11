import Link from "next/link";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { categories, productImages, products, sellerProfiles } from "@/db/schema";
import { ProductCard } from "@/components/product-card";
import { ProductSuggestions } from "@/components/product-suggestions";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

type SearchParams = {
  q?: string;
  categorie?: string;
  prix_min?: string;
  prix_max?: string;
  en_stock?: string;
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
  if (params.q?.trim()) {
    const pattern = `%${params.q.trim()}%`;
    filters.push(
      or(ilike(products.title, pattern), ilike(products.description, pattern))!,
    );
  }
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
  const prixMin = Number(params.prix_min);
  if (prixMin > 0) filters.push(gte(products.priceFcfa, prixMin));
  const prixMax = Number(params.prix_max);
  if (prixMax > 0) filters.push(lte(products.priceFcfa, prixMax));
  if (params.en_stock === "1") filters.push(gt(products.stock, 0));

  const where = and(...filters);
  const orderBy =
    params.tri === "prix-asc"
      ? asc(products.priceFcfa)
      : params.tri === "prix-desc"
        ? desc(products.priceFcfa)
        : desc(products.createdAt);

  const [{ total }] = await db
    .select({ total: count() })
    .from(products)
    .where(where);

  const rows = await db
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
    .leftJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .where(where)
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader query={params.q} />
      <main className="mx-auto w-full max-w-(--container-page) flex-1 px-4 py-8 md:px-10">
        <h1 className="font-display text-2xl font-extrabold">
          {selected ? selected.name : params.q ? `Résultats pour « ${params.q} »` : "Catalogue"}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {total} produit{total > 1 ? "s" : ""}
        </p>

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
            Trier par
            <select
              name="tri"
              defaultValue={params.tri ?? ""}
              className="rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            >
              <option value="">Plus récents</option>
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

        {/* Grille produits */}
        {rows.length === 0 ? (
          <>
            <p className="mt-12 text-center text-ink-muted">
              Aucun produit ne correspond à votre recherche.
            </p>
            <ProductSuggestions title="Découvrez plutôt ces produits" />
          </>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((product) => (
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

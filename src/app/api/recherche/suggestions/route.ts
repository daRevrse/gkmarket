import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, sellerProfiles } from "@/db/schema";
import { publishedProducts } from "@/lib/catalog";
import { basePriceFcfa } from "@/lib/pricing";
import { productPath } from "@/lib/product-url";
import {
  normalizeQuery,
  popularSearches,
  productSearch,
  suggestCorrection,
  type ProductSearch,
} from "@/lib/search";

export type SearchSuggestions = {
  /** Requête corrigée quand la saisie ne donnait rien (« telefone »). */
  correction: string | null;
  products: { title: string; href: string; imageUrl: string | null; priceFcfa: number }[];
  categories: { name: string; href: string }[];
  shops: { name: string; href: string }[];
  /** Recherches fréquentes (saisie vide). */
  popular: string[];
};

const EMPTY: SearchSuggestions = {
  correction: null,
  products: [],
  categories: [],
  shops: [],
  popular: [],
};

/**
 * Autocomplétion de la barre de recherche (lot 4) : produits, rayons et
 * boutiques correspondant à la saisie ; recherches fréquentes si elle est
 * vide. Contenu public, mis en cache quelques secondes.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const normalized = normalizeQuery(raw);
  const headers = { "Cache-Control": "public, max-age=30, s-maxage=60" };

  if (normalized.length < 2) {
    const popular = await popularSearches(8).catch(() => []);
    return Response.json(
      { ...EMPTY, popular: popular.map((row) => row.query) } satisfies SearchSuggestions,
      { headers },
    );
  }

  let search = await productSearch(normalized);
  if (!search) return Response.json(EMPTY, { headers });

  const findProducts = (candidate: ProductSearch) =>
    publishedProducts()
      .where(and(eq(products.status, "published"), candidate.where))
      .orderBy(desc(candidate.rank))
      .limit(6);

  let found = await findProducts(search);
  let correction: string | null = null;
  if (found.length === 0) {
    const corrected = await suggestCorrection(normalized);
    const correctedSearch = corrected ? await productSearch(corrected) : null;
    if (correctedSearch) {
      found = await findProducts(correctedSearch);
      if (found.length > 0) {
        correction = corrected;
        search = correctedSearch;
      }
    }
  }

  const pattern = `%${search.normalized}%`;
  const [categoryRows, shopRows] = await Promise.all([
    db
      .select({ name: categories.name, slug: categories.slug })
      .from(categories)
      .where(sql`public.immutable_unaccent(lower(${categories.name})) LIKE ${pattern}`)
      .orderBy(asc(categories.position))
      .limit(3),
    db
      .select({ id: sellerProfiles.id, name: sellerProfiles.shopName })
      .from(sellerProfiles)
      .where(
        and(
          eq(sellerProfiles.status, "approved"),
          sql`public.immutable_unaccent(lower(${sellerProfiles.shopName})) LIKE ${pattern}`,
        ),
      )
      .limit(3),
  ]);

  return Response.json(
    {
      correction,
      products: found.map((product) => ({
        title: product.title,
        href: productPath(product),
        imageUrl: product.imageUrl,
        priceFcfa: basePriceFcfa({ ...product, wholesaleMinQty: null }),
      })),
      categories: categoryRows.map((row) => ({
        name: row.name,
        href: `/produits?categorie=${row.slug}`,
      })),
      shops: shopRows.map((row) => ({ name: row.name, href: `/boutique/${row.id}` })),
      popular: [],
    } satisfies SearchSuggestions,
    { headers },
  );
}

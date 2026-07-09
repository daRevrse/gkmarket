import { and, desc, eq, notInArray } from "drizzle-orm";
import { products } from "@/db/schema";
import { ProductCard, type CatalogProduct } from "@/components/product-card";
import { publishedProducts } from "@/lib/catalog";

/**
 * Rayon de suggestions pour les états vides des pages publiques (panier vide,
 * recherche sans résultat…) : on garde toujours des produits à choisir sous
 * les yeux du visiteur plutôt qu'un cul-de-sac.
 */
export async function ProductSuggestions({
  title = "Ces produits pourraient vous plaire",
  excludeIds = [],
  limit = 6,
}: {
  title?: string;
  excludeIds?: string[];
  limit?: number;
}) {
  const conditions = [eq(products.status, "published")];
  if (excludeIds.length > 0) {
    conditions.push(notInArray(products.id, excludeIds));
  }

  const items = await publishedProducts()
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  if (items.length === 0) return null;

  return (
    <section className="pt-10">
      <h2 className="mb-5 font-display text-xl font-bold">{title}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((product: CatalogProduct) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

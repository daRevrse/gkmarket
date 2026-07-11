import { asc, count } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { CategoryManager, type CategoryNode } from "./category-manager";

export default async function AdminCategoriesPage() {
  const [allCategories, counts] = await Promise.all([
    db
      .select()
      .from(categories)
      .orderBy(asc(categories.position), asc(categories.name)),
    db
      .select({ categoryId: products.categoryId, n: count() })
      .from(products)
      .groupBy(products.categoryId),
  ]);
  const countById = new Map(counts.map((row) => [row.categoryId, row.n]));

  const tree: CategoryNode[] = allCategories
    .filter((c) => !c.parentId)
    .map((root) => ({
      id: root.id,
      name: root.name,
      slug: root.slug,
      productCount: countById.get(root.id) ?? 0,
      children: allCategories
        .filter((c) => c.parentId === root.id)
        .map((child) => ({
          id: child.id,
          name: child.name,
          slug: child.slug,
          productCount: countById.get(child.id) ?? 0,
        })),
    }));

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Catégories</h1>
        <p className="mt-1 text-ink-muted">
          Deux niveaux : catégorie › sous-catégorie (les produits se rattachent
          aux sous-catégories). Une catégorie utilisée ne peut pas être
          supprimée.
        </p>
      </div>
      <CategoryManager tree={tree} />
    </main>
  );
}

import "server-only";

import { asc, eq, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { categories } from "@/db/schema";
import type { CategoryOption } from "./product-form";

/** Sous-catégories groupées par catégorie parente, pour le sélecteur produit. */
export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const parents = alias(categories, "parents");
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentName: parents.name,
    })
    .from(categories)
    .innerJoin(parents, eq(parents.id, categories.parentId))
    .where(isNotNull(categories.parentId))
    .orderBy(asc(parents.position), asc(categories.position));
  return rows;
}

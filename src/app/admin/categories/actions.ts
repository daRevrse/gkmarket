"use server";

import { revalidatePath } from "next/cache";
import { count, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

/** Slug URL à partir du nom (accents retirés), unicité garantie par suffixe. */
async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "categorie";
  const taken = new Set(
    (
      await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(sql`${categories.slug} LIKE ${`${base}%`}`)
    ).map((row) => row.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  }
}

function revalidateCatalog() {
  revalidatePath("/admin/categories");
  revalidatePath("/produits");
  revalidatePath("/");
}

/** Création d'une catégorie racine ou d'une sous-catégorie (MVP n°264). */
export async function createCategory(
  name: string,
  parentId: string | null,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Le nom est requis." };

  if (parentId) {
    const [parent] = await db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1);
    if (!parent) return { error: "Catégorie parente introuvable." };
    // Deux niveaux maximum : pas de sous-sous-catégorie.
    if (parent.parentId) {
      return { error: "Une sous-catégorie ne peut pas avoir d'enfants." };
    }
  }

  const [{ maxPos }] = await db
    .select({ maxPos: max(categories.position) })
    .from(categories)
    .where(parentId ? eq(categories.parentId, parentId) : isNull(categories.parentId));

  await db.insert(categories).values({
    name: trimmed,
    slug: await uniqueSlug(trimmed),
    parentId,
    position: (maxPos ?? 0) + 1,
  });

  await logAdmin(admin.id, "Catégorie créée", {
    targetType: "categorie",
    details: trimmed,
  });

  revalidateCatalog();
  return {};
}

/** Renommage (MVP n°265) : le slug est conservé (liens existants intacts). */
export async function renameCategory(
  categoryId: string,
  name: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Le nom est requis." };

  const updated = await db
    .update(categories)
    .set({ name: trimmed })
    .where(eq(categories.id, categoryId))
    .returning({ id: categories.id });
  if (updated.length === 0) return { error: "Catégorie introuvable." };

  await logAdmin(admin.id, "Catégorie renommée", {
    targetType: "categorie",
    targetId: categoryId,
    details: trimmed,
  });

  revalidateCatalog();
  return {};
}

/**
 * Suppression (MVP n°266), refusée si la catégorie a des sous-catégories ou
 * des produits : on ne casse jamais un rattachement existant.
 */
export async function deleteCategory(
  categoryId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const [[children], [used], [category]] = await Promise.all([
    db
      .select({ n: count() })
      .from(categories)
      .where(eq(categories.parentId, categoryId)),
    db
      .select({ n: count() })
      .from(products)
      .where(eq(products.categoryId, categoryId)),
    db
      .select({ name: categories.name })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1),
  ]);
  if (!category) return { error: "Catégorie introuvable." };
  if (children.n > 0) {
    return {
      error: `Supprimez d'abord les ${children.n} sous-catégorie(s).`,
    };
  }
  if (used.n > 0) {
    return {
      error: `${used.n} produit(s) utilisent cette catégorie : déplacez-les d'abord.`,
    };
  }

  await db.delete(categories).where(eq(categories.id, categoryId));

  await logAdmin(admin.id, "Catégorie supprimée", {
    targetType: "categorie",
    targetId: categoryId,
    details: category.name,
  });

  revalidateCatalog();
  return {};
}

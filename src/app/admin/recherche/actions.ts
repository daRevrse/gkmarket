"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { searchSynonyms } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";
import { normalizeQuery } from "@/lib/search";

/**
 * Ajoute un groupe de synonymes (« pagne, wax, tissu ») : une recherche sur
 * l'un des termes trouvera aussi les autres.
 */
export async function addSynonymGroup(input: string): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const terms = [
    ...new Set(
      input
        .split(/[,;\n]/)
        .map(normalizeQuery)
        .filter((term) => term.length >= 2),
    ),
  ].slice(0, 12);
  if (terms.length < 2) {
    return { error: "Indiquez au moins deux termes séparés par des virgules." };
  }

  await db.insert(searchSynonyms).values({ terms });
  await logAdmin(admin.id, "Synonymes de recherche ajoutés", {
    targetType: "recherche",
    details: terms.join(", "),
  });
  revalidatePath("/admin/recherche");
  return {};
}

/** Supprime un groupe de synonymes. */
export async function deleteSynonymGroup(id: string): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const [deleted] = await db
    .delete(searchSynonyms)
    .where(eq(searchSynonyms.id, id))
    .returning({ terms: searchSynonyms.terms })
    .catch(() => []);
  if (!deleted) return { error: "Groupe introuvable." };

  await logAdmin(admin.id, "Synonymes de recherche supprimés", {
    targetType: "recherche",
    details: deleted.terms.join(", "),
  });
  revalidatePath("/admin/recherche");
  return {};
}

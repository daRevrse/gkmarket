import "server-only";

import { desc, gt, max, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  products,
  searchQueries,
  searchSynonyms,
  sellerProfiles,
} from "@/db/schema";

// Recherche intelligente (docs/CHANGEMENTS.md §5, lot 4) : plein texte
// français sans accents (products.search_vector, migration 0021), préfixes,
// synonymes locaux, rayons et boutiques, classement par pertinence ; sans
// résultat, correction des fautes de frappe (suggestCorrection).

/** Similarité minimale (trigrammes) pour corriger un mot mal orthographié. */
const TYPO_SIMILARITY = 0.4;

/** Minuscules, sans accents, ponctuation réduite à des espaces. */
export function normalizeQuery(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Mots significatifs de la requête (2 caractères minimum). */
function tokenize(normalized: string): string[] {
  return [...new Set(normalized.split(" ").filter((word) => word.length >= 2))].slice(0, 8);
}

/** Groupes de synonymes (petite table, relue à chaque recherche). */
async function synonymGroups(): Promise<string[][]> {
  const rows = await db.select({ terms: searchSynonyms.terms }).from(searchSynonyms);
  return rows.map((row) => row.terms);
}

/**
 * tsquery : chaque mot (ou l'un de ses synonymes) doit apparaître, en
 * préfixe (« telep » trouve « téléphone »). Les synonymes de plusieurs mots
 * deviennent des expressions (mobile <-> money).
 */
function toTsQuery(tokens: string[], groups: string[][], joiner: " & " | " | "): string {
  return tokens
    .map((token) => {
      const alternatives = new Set([token]);
      for (const group of groups) {
        // Termes renormalisés : seuls [a-z0-9 ] entrent dans la tsquery.
        const terms = group.map(normalizeQuery).filter(Boolean);
        if (terms.includes(token)) terms.forEach((term) => alternatives.add(term));
      }
      const parts = [...alternatives].map((term) => {
        const words = term.split(" ").filter(Boolean);
        return words.length > 1
          ? `(${words.map((word) => `${word}:*`).join(" <-> ")})`
          : `${term}:*`;
      });
      return `(${parts.join(" | ")})`;
    })
    .join(joiner);
}

export type ProductSearch = {
  /** Condition à ajouter au WHERE (produits correspondants). */
  where: SQL;
  /** Score de pertinence, pour ORDER BY … DESC. */
  rank: SQL;
  normalized: string;
};

/**
 * Condition et score de recherche pour une requête libre, ou null si la
 * requête ne contient aucun mot exploitable.
 */
export async function productSearch(raw: string): Promise<ProductSearch | null> {
  const normalized = normalizeQuery(raw);
  const tokens = tokenize(normalized);
  if (tokens.length === 0) return null;

  const groups = await synonymGroups();
  const allWords = sql`to_tsquery('french', ${toTsQuery(tokens, groups, " & ")})`;
  const anyWord = sql`to_tsquery('french', ${toTsQuery(tokens, groups, " | ")})`;
  const title = sql`public.immutable_unaccent(lower(${products.title}))`;
  const pattern = `%${normalized}%`;

  // Rayon (sous-catégorie ou catégorie parente) ou boutique dont le nom
  // contient la requête.
  const inCategory = sql`${products.categoryId} IN (
    SELECT c.id FROM ${categories} c
    LEFT JOIN ${categories} p ON p.id = c.parent_id
    WHERE public.immutable_unaccent(lower(c.name)) LIKE ${pattern}
       OR public.immutable_unaccent(lower(coalesce(p.name, ''))) LIKE ${pattern}
  )`;
  const inShop = sql`${products.sellerId} IN (
    SELECT s.id FROM ${sellerProfiles} s
    WHERE public.immutable_unaccent(lower(s.shop_name)) LIKE ${pattern}
  )`;
  return {
    normalized,
    where: sql`(${sql.raw('"products"."search_vector"')} @@ ${allWords} OR ${inCategory} OR ${inShop})`,
    rank: sql`(
      ts_rank_cd(${sql.raw('"products"."search_vector"')}, ${allWords}) * 4
      + ts_rank(${sql.raw('"products"."search_vector"')}, ${anyWord})
      + word_similarity(${normalized}, ${title})
      + CASE WHEN ${title} LIKE ${`${normalized}%`} THEN 1 ELSE 0 END
      + CASE WHEN ${inCategory} THEN 0.3 ELSE 0 END
    )`,
  };
}

/**
 * Correction orthographique d'une requête sans résultat : chaque mot d'au
 * moins 4 lettres est remplacé par le mot le plus proche du vocabulaire du
 * catalogue (titres, rayons, synonymes). Null si rien n'a changé.
 */
export async function suggestCorrection(normalized: string): Promise<string | null> {
  const tokens = tokenize(normalized).filter(
    (token) => token.length >= 4 && !/^[0-9]+$/.test(token),
  );
  if (tokens.length === 0) return null;

  const { rows } = await db.execute<{ token: string; best: string | null; score: number | null }>(sql`
    WITH vocab AS (
      SELECT DISTINCT w AS word FROM (
        SELECT regexp_split_to_table(public.immutable_unaccent(lower(${products.title})), '[^a-z0-9]+') AS w
          FROM ${products} WHERE ${products.status} = 'published'
        UNION ALL
        SELECT regexp_split_to_table(public.immutable_unaccent(lower(${categories.name})), '[^a-z0-9]+')
          FROM ${categories}
        UNION ALL
        SELECT unnest(${searchSynonyms.terms}) FROM ${searchSynonyms}
      ) words
      WHERE length(w) >= 3
    )
    SELECT q.token,
           best.word AS best,
           best.score
      FROM regexp_split_to_table(${tokens.join(" ")}, ' ') AS q(token)
      LEFT JOIN LATERAL (
        SELECT word, similarity(word, q.token) AS score
          FROM vocab
         ORDER BY similarity(word, q.token) DESC
         LIMIT 1
      ) best ON true
  `);

  const corrections = new Map<string, string>();
  for (const row of rows) {
    if (row.best && row.best !== row.token && Number(row.score) >= TYPO_SIMILARITY) {
      corrections.set(row.token, row.best);
    }
  }
  if (corrections.size === 0) return null;
  return normalized
    .split(" ")
    .map((word) => corrections.get(word) ?? word)
    .join(" ");
}

/**
 * Journalise une recherche (anonyme), avec son nombre de résultats recalculé
 * ici - correction orthographique comprise, comme sur le catalogue.
 * Best-effort : ne lève jamais.
 */
export async function logSearch(raw: string): Promise<void> {
  try {
    const search = await productSearch(raw);
    if (!search) return;
    const countFor = async (candidate: ProductSearch) =>
      (
        await db
          .select({ total: sql<number>`count(*)::int` })
          .from(products)
          .where(
            sql`${products.status} = 'published' AND ${products.sellerId} IN (
              SELECT id FROM ${sellerProfiles} WHERE status = 'approved'
            ) AND ${candidate.where}`,
          )
      )[0].total;
    let results = await countFor(search);
    if (results === 0) {
      const correction = await suggestCorrection(search.normalized);
      const corrected = correction ? await productSearch(correction) : null;
      if (corrected) results = await countFor(corrected);
    }
    await db.insert(searchQueries).values({ query: search.normalized, results });
  } catch {
    // Statistiques indisponibles : sans incidence.
  }
}

const SINCE_30_DAYS = sql`now() - interval '30 days'`;

/** Recherches les plus fréquentes des 30 derniers jours. */
export async function popularSearches(limit = 8, withResultsOnly = true) {
  return db
    .select({
      query: searchQueries.query,
      count: sql<number>`count(*)::int`,
      results: sql<number>`round(avg(${searchQueries.results}))::int`,
    })
    .from(searchQueries)
    .where(
      withResultsOnly
        ? sql`${searchQueries.createdAt} > ${SINCE_30_DAYS} AND ${searchQueries.results} > 0`
        : gt(searchQueries.createdAt, SINCE_30_DAYS),
    )
    .groupBy(searchQueries.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/**
 * Demande non servie des 30 derniers jours : requêtes restées sans aucun
 * résultat à chaque recherche (une requête servie depuis, par un nouveau
 * produit ou un synonyme, sort de la liste).
 */
export async function unmetSearches(limit = 10) {
  return db
    .select({
      query: searchQueries.query,
      count: sql<number>`count(*)::int`,
      lastAt: max(searchQueries.createdAt),
    })
    .from(searchQueries)
    .where(gt(searchQueries.createdAt, SINCE_30_DAYS))
    .groupBy(searchQueries.query)
    .having(sql`bool_and(${searchQueries.results} = 0)`)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${searchQueries.createdAt})`))
    .limit(limit);
}

import "server-only";

import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  productImageEmbeddings,
  productImages,
  products,
  sellerProfiles,
} from "@/db/schema";
import { adminStorage } from "@/lib/firebase/admin";
import { embedImage } from "@/lib/image-embedding";

// Index visuel du catalogue (lot 7) : une entrée par photo produit. Le
// calcul est fait hors du chemin critique (après la réponse, via `after()`)
// et rattrapable par lots depuis l'administration.

/** Photos publiées qui n'ont pas encore de vecteur. */
export async function pendingImageIndex(): Promise<{
  pending: number;
  indexed: number;
}> {
  const [[pending], [indexed]] = await Promise.all([
    db
      .select({ value: count() })
      .from(productImages)
      .innerJoin(products, eq(products.id, productImages.productId))
      .leftJoin(
        productImageEmbeddings,
        eq(productImageEmbeddings.imageId, productImages.id),
      )
      .where(
        and(
          eq(products.status, "published"),
          isNull(productImageEmbeddings.imageId),
        ),
      ),
    db.select({ value: count() }).from(productImageEmbeddings),
  ]);
  return { pending: pending?.value ?? 0, indexed: indexed?.value ?? 0 };
}

async function embedStoredImage(path: string) {
  const [buffer] = await adminStorage.bucket().file(path).download();
  return embedImage(buffer);
}

/** Indexe (ou réindexe) toutes les photos d'un produit. */
export async function indexProduct(productId: string): Promise<number> {
  const images = await db
    .select({ id: productImages.id, path: productImages.path })
    .from(productImages)
    .where(eq(productImages.productId, productId));

  let done = 0;
  for (const image of images) {
    try {
      const embedding = await embedStoredImage(image.path);
      await db
        .insert(productImageEmbeddings)
        .values({ imageId: image.id, productId, embedding })
        .onConflictDoUpdate({
          target: productImageEmbeddings.imageId,
          set: { embedding, productId, createdAt: new Date() },
        });
      done += 1;
    } catch {
      // Photo illisible ou stockage indisponible : on passe, le rattrapage
      // par lots la reprendra.
    }
  }
  return done;
}

/**
 * Rattrapage : indexe jusqu'à `limit` photos publiées encore sans vecteur.
 * Distingue les photos indexées de celles qui n'ont pas pu être lues, pour
 * que l'administration voie un index bloqué plutôt qu'un index terminé.
 */
export async function indexPending(
  limit = 25,
): Promise<{ done: number; failed: number }> {
  const rows = await db
    .select({
      id: productImages.id,
      path: productImages.path,
      productId: productImages.productId,
    })
    .from(productImages)
    .innerJoin(products, eq(products.id, productImages.productId))
    .leftJoin(
      productImageEmbeddings,
      eq(productImageEmbeddings.imageId, productImages.id),
    )
    .where(
      and(eq(products.status, "published"), isNull(productImageEmbeddings.imageId)),
    )
    .limit(limit);

  let done = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const embedding = await embedStoredImage(row.path);
      await db
        .insert(productImageEmbeddings)
        .values({ imageId: row.id, productId: row.productId, embedding })
        .onConflictDoNothing();
      done += 1;
    } catch {
      // Photo illisible : on n'interrompt pas le lot pour autant.
      failed += 1;
    }
  }
  return { done, failed };
}

/**
 * Seuil de similarité en deçà duquel un produit n'est pas proposé. CLIP
 * rend des cosinus resserrés (deux photos sans rapport tournent déjà autour
 * de 0,6) : cette valeur de départ demande à être ajustée en observant les
 * recherches réelles (`image_searches.results`), d'où la surcharge par
 * variable d'environnement.
 */
export const MIN_SIMILARITY = Number(
  process.env.IMAGE_SEARCH_MIN_SCORE ?? "0.72",
);

/**
 * Écart maximal avec le meilleur résultat. Le seuil absolu seul ne suffit
 * pas : CLIP note toutes les photos de produits dans une plage étroite, si
 * bien qu'une photo parlante et une photo quelconque passeraient toutes deux.
 * Cette marge garde le peloton de tête et coupe la traîne.
 */
export const SCORE_MARGIN = Number(
  process.env.IMAGE_SEARCH_MARGIN ?? "0.1",
);

export type VisualMatch = { productId: string; score: number };

/**
 * Littéral `real[]` pour la requête. Les valeurs viennent du modèle, mais on
 * les assainit quand même : jamais de texte interpolé tel quel en SQL.
 */
function toSqlVector(embedding: number[]) {
  const values = embedding
    .map((value) => (Number.isFinite(value) ? Number(value).toFixed(6) : "0"))
    .join(",");
  return sql`${sql.raw(`ARRAY[${values}]`)}::real[]`;
}

/**
 * Produits visuellement proches d'un vecteur, du plus proche au plus
 * éloigné. Le score d'un produit est celui de sa meilleure photo.
 */
export async function visualMatches(
  embedding: number[],
  limit = 60,
): Promise<VisualMatch[]> {
  const vector = toSqlVector(embedding);
  const score = sql<number>`max(public.dot_product(${productImageEmbeddings.embedding}, ${vector}))`;

  const rows = await db
    .select({ productId: productImageEmbeddings.productId, score })
    .from(productImageEmbeddings)
    .innerJoin(products, eq(products.id, productImageEmbeddings.productId))
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    )
    .where(eq(products.status, "published"))
    .groupBy(productImageEmbeddings.productId)
    .having(sql`${score} >= ${MIN_SIMILARITY}`)
    .orderBy(sql`${score} desc`)
    .limit(limit);

  const matches = rows.map((row) => ({
    productId: row.productId,
    score: Number(row.score),
  }));
  const best = matches[0]?.score ?? 0;
  return matches.filter((match) => best - match.score <= SCORE_MARGIN);
}

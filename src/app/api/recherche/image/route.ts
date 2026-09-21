import { lt } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db";
import { imageSearches } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { embedImage } from "@/lib/image-embedding";
import { visualMatches } from "@/lib/image-index";

/** Taille maximale acceptée pour la photo envoyée. */
const MAX_SIZE = 8 * 1024 * 1024;
/** Durée de conservation d'une recherche (URL partageable, rechargement). */
const KEEP_DAYS = 7;

/**
 * Recherche par photo (docs/CHANGEMENTS.md §5, lot 7). Reçoit une image,
 * calcule son vecteur CLIP sur le serveur, enregistre la recherche et
 * renvoie l'identifiant à ouvrir : /produits?image=<id>.
 */
export async function POST(request: Request) {
  // Le fichier est envoyé tel quel dans le corps (pas de multipart) :
  // le navigateur pose le bon Content-Type et la lecture reste triviale.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return Response.json(
      { error: "Envoyez une photo (JPEG, PNG ou WebP)." },
      { status: 415 },
    );
  }
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_SIZE) {
    return Response.json({ error: "La photo dépasse 8 Mo." }, { status: 413 });
  }

  const body = await request.arrayBuffer().catch(() => null);
  if (!body || body.byteLength === 0) {
    return Response.json({ error: "Aucune image reçue." }, { status: 400 });
  }
  if (body.byteLength > MAX_SIZE) {
    return Response.json({ error: "La photo dépasse 8 Mo." }, { status: 413 });
  }

  const buffer = Buffer.from(body);

  let embedding: number[];
  let thumbnail: string;
  try {
    // Vignette d'abord : elle valide aussi que le fichier est bien une image.
    const small = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(200, 200, { fit: "cover" })
      .jpeg({ quality: 70 })
      .toBuffer();
    thumbnail = small.toString("base64");
    embedding = await embedImage(buffer);
  } catch {
    return Response.json(
      { error: "Photo illisible. Réessayez avec une autre image." },
      { status: 422 },
    );
  }

  const matches = await visualMatches(embedding);
  const user = await getCurrentUser();
  const [row] = await db
    .insert(imageSearches)
    .values({
      userId: user?.id ?? null,
      embedding,
      thumbnail,
      results: matches.length,
    })
    .returning({ id: imageSearches.id });

  // Purge opportuniste : pas de tâche planifiée pour si peu de lignes.
  await db
    .delete(imageSearches)
    .where(
      lt(imageSearches.createdAt, new Date(Date.now() - KEEP_DAYS * 86400_000)),
    )
    .catch(() => undefined);

  return Response.json({ id: row.id, results: matches.length });
}

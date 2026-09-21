import { Readable } from "node:stream";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productImages, products, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase/admin";
import { productIdFromParam, productSlug } from "@/lib/product-url";
import { watermarkImage } from "@/lib/watermark";

/**
 * Téléchargement des médias d'un produit (docs/CHANGEMENTS.md §5, lot 6).
 * Réservé aux comptes connectés ; les photos repartent avec le filigrane
 * « Deal Lomé ». `?i=<rang>` pour une photo, `?video=1` pour la vidéo de
 * présentation (servie telle quelle : marquer une vidéo demanderait un
 * ré-encodage ffmpeg).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 403 });

  const { id: param } = await params;
  const id = productIdFromParam(param);
  if (!id) return new Response(null, { status: 404 });

  // Le média n'est téléchargeable que si la fiche est publique.
  const [product] = await db
    .select({
      title: products.title,
      videoPath: products.videoPath,
      shopName: sellerProfiles.shopName,
    })
    .from(products)
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    )
    .where(and(eq(products.id, id), eq(products.status, "published")))
    .limit(1);
  if (!product) return new Response(null, { status: 404 });

  const url = new URL(request.url);
  const base = productSlug(product.title) || "media";

  if (url.searchParams.get("video") === "1") {
    if (!product.videoPath) return new Response(null, { status: 404 });
    return streamFile(request, product.videoPath, `${base}.mp4`);
  }

  const index = Number(url.searchParams.get("i") ?? "0");
  if (!Number.isInteger(index) || index < 0) {
    return new Response(null, { status: 400 });
  }
  const images = await db
    .select({ path: productImages.path })
    .from(productImages)
    .where(eq(productImages.productId, id))
    .orderBy(asc(productImages.position));
  const image = images[index];
  if (!image) return new Response(null, { status: 404 });

  try {
    const [buffer] = await adminStorage.bucket().file(image.path).download();
    const marked = await watermarkImage(
      buffer,
      `${product.title} - ${product.shopName}`,
    );
    return new Response(new Uint8Array(marked), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(marked.length),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}-${index + 1}.jpg`)}`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

/** Vidéo : flux direct depuis Storage, avec requêtes partielles (Range). */
async function streamFile(request: Request, path: string, filename: string) {
  try {
    const file = adminStorage.bucket().file(path);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    const headers: Record<string, string> = {
      "Content-Type": metadata.contentType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    };

    const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && size > 0) {
      let start = range[1] ? Number(range[1]) : NaN;
      let end = range[2] ? Number(range[2]) : size - 1;
      if (Number.isNaN(start)) {
        start = Math.max(0, size - end);
        end = size - 1;
      }
      end = Math.min(end, size - 1);
      if (start > end || start >= size) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      return new Response(
        Readable.toWeb(file.createReadStream({ start, end })) as ReadableStream,
        {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": `bytes ${start}-${end}/${size}`,
            "Content-Length": String(end - start + 1),
          },
        },
      );
    }

    return new Response(
      Readable.toWeb(file.createReadStream()) as ReadableStream,
      { headers: { ...headers, "Content-Length": String(size) } },
    );
  } catch {
    return new Response(null, { status: 404 });
  }
}

import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationMessages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { adminStorage } from "@/lib/firebase/admin";
import { conversationParticipants } from "@/lib/messaging";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pièce jointe d'un message (photo, PDF, vocal). Les fichiers ne sont jamais
 * lisibles directement dans Storage (règles read: false) : accès réservé aux
 * deux parties de la conversation et aux admins (surveillance). Gère les
 * requêtes partielles (Range), nécessaires à la lecture audio sur Safari.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 403 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(null, { status: 404 });

  const [message] = await db
    .select({
      conversationId: conversationMessages.conversationId,
      path: conversationMessages.attachmentPath,
      meta: conversationMessages.meta,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.id, id))
    .limit(1);
  if (!message?.path) return new Response(null, { status: 404 });

  if (!user.isAdmin) {
    const parties = await conversationParticipants(message.conversationId);
    if (!parties?.includes(user.id)) return new Response(null, { status: 403 });
  }

  try {
    const file = adminStorage.bucket().file(message.path);
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size ?? 0);
    const contentType = metadata.contentType ?? "application/octet-stream";
    const name = message.meta?.file?.name ?? "fichier";
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Accept-Ranges": "bytes",
      // Contenu immuable, mais privé : jamais en cache partagé.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    };

    const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && size > 0) {
      let start = range[1] ? Number(range[1]) : NaN;
      let end = range[2] ? Number(range[2]) : size - 1;
      if (Number.isNaN(start)) {
        // « bytes=-500 » : les 500 derniers octets.
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
      const stream = file.createReadStream({ start, end });
      return new Response(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }

    return new Response(Readable.toWeb(file.createReadStream()) as ReadableStream, {
      headers: { ...headers, "Content-Length": String(size) },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

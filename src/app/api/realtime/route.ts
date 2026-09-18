import { getCurrentUser } from "@/lib/auth";
import { subscribe } from "@/lib/realtime";

const HEARTBEAT_MS = 25_000;

/**
 * Flux temps réel (Server-Sent Events) de l'utilisateur connecté : nouveaux
 * messages, accusés de lecture, « en train d'écrire ». Un flux par onglet.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      // Délai de reconnexion du navigateur en cas de coupure.
      send("retry: 5000\n\n");
      const unsubscribe = subscribe(user.id, (event) =>
        send(`data: ${JSON.stringify(event)}\n\n`),
      );
      // Commentaire périodique : garde la connexion ouverte à travers les proxys.
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        cleanup = () => {};
        try {
          controller.close();
        } catch {
          // Déjà fermé.
        }
      };
      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Pas de compression (elle retiendrait les événements en tampon).
      "Content-Encoding": "none",
      "X-Accel-Buffering": "no",
    },
  });
}

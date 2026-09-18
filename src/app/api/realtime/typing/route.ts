import { conversationParticipants } from "@/lib/messaging";
import { getCurrentUser } from "@/lib/auth";
import { publish } from "@/lib/realtime";

/** Signale à l'autre partie que l'utilisateur est en train d'écrire. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const { conversationId } = (await request.json().catch(() => ({}))) as {
    conversationId?: string;
  };
  if (typeof conversationId !== "string") {
    return new Response(null, { status: 400 });
  }

  const parties = await conversationParticipants(conversationId);
  if (!parties || !parties.includes(user.id)) {
    return new Response(null, { status: 403 });
  }

  await publish(
    parties.filter((id) => id !== user.id),
    { type: "typing", conversationId },
  );
  return new Response(null, { status: 204 });
}

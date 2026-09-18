import "server-only";

import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationMessages,
  conversations,
  sellerProfiles,
  type MessageMeta,
} from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";
import { publish } from "@/lib/realtime";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type MessageKind = (typeof conversationMessages.$inferSelect)["kind"];

/** Aperçu texte d'un message (listes, notifications). */
export function messagePreview(message: {
  kind: MessageKind;
  body: string;
  meta: MessageMeta | null;
}): string {
  switch (message.kind) {
    case "product":
      return `Fiche produit : ${message.meta?.product?.title ?? "produit"}`;
    case "image":
      return "Photo";
    case "file":
      return `Document : ${message.meta?.file?.name ?? "PDF"}`;
    case "audio":
      return "Message vocal";
    default:
      return message.body;
  }
}

/** Utilisateurs d'une conversation : [acheteur, vendeur] (null si inconnue). */
export async function conversationParticipants(
  conversationId: string,
): Promise<[string, string] | null> {
  if (!UUID_RE.test(conversationId)) return null;
  const [row] = await db
    .select({
      buyerId: conversations.buyerId,
      sellerUserId: sellerProfiles.userId,
    })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ? [row.buyerId, row.sellerUserId] : null;
}

/** Les 200 derniers messages d'une conversation, du plus ancien au plus récent. */
export async function loadThread(conversationId: string) {
  const rows = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(200);
  return rows.reverse();
}

/** Dernier message + nombre de non-lus par conversation (aperçus de liste). */
export async function conversationSummaries(
  conversationIds: string[],
  meId: string,
): Promise<{
  lastByConv: Map<string, string>;
  unreadByConv: Map<string, number>;
}> {
  if (conversationIds.length === 0) {
    return { lastByConv: new Map(), unreadByConv: new Map() };
  }

  const [recent, unread] = await Promise.all([
    db
      .selectDistinctOn([conversationMessages.conversationId], {
        conversationId: conversationMessages.conversationId,
        kind: conversationMessages.kind,
        body: conversationMessages.body,
        meta: conversationMessages.meta,
      })
      .from(conversationMessages)
      .where(inArray(conversationMessages.conversationId, conversationIds))
      .orderBy(
        conversationMessages.conversationId,
        desc(conversationMessages.createdAt),
      ),
    db
      .select({
        conversationId: conversationMessages.conversationId,
        n: count(),
      })
      .from(conversationMessages)
      .where(
        and(
          inArray(conversationMessages.conversationId, conversationIds),
          isNull(conversationMessages.readAt),
          ne(conversationMessages.senderId, meId),
        ),
      )
      .groupBy(conversationMessages.conversationId),
  ]);

  return {
    lastByConv: new Map(
      recent.map((message) => [message.conversationId, messagePreview(message)]),
    ),
    unreadByConv: new Map(unread.map((row) => [row.conversationId, row.n])),
  };
}

/** Non-lus globaux pour les badges de la sidebar (acheteur et vendeur). */
export async function unreadMessageCounts(
  user: CurrentUser,
): Promise<{ buyer: number; seller: number }> {
  const [buyerRows, sellerRows] = await Promise.all([
    db
      .select({ n: count() })
      .from(conversationMessages)
      .innerJoin(
        conversations,
        eq(conversations.id, conversationMessages.conversationId),
      )
      .where(
        and(
          eq(conversations.buyerId, user.id),
          isNull(conversationMessages.readAt),
          ne(conversationMessages.senderId, user.id),
        ),
      ),
    user.sellerProfile?.status === "approved"
      ? db
          .select({ n: count() })
          .from(conversationMessages)
          .innerJoin(
            conversations,
            eq(conversations.id, conversationMessages.conversationId),
          )
          .where(
            and(
              eq(conversations.sellerId, user.sellerProfile.id),
              isNull(conversationMessages.readAt),
              ne(conversationMessages.senderId, user.id),
            ),
          )
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { buyer: buyerRows[0]?.n ?? 0, seller: sellerRows[0]?.n ?? 0 };
}

/**
 * Marque comme lus les messages reçus dans une conversation et prévient
 * l'autre partie (accusé « Vu » en temps réel) ainsi que le lecteur : son
 * badge de non-lus, rendu en parallèle par le layout, se met à jour.
 */
export async function markConversationRead(
  conversationId: string,
  meId: string,
  otherUserId: string,
): Promise<void> {
  const updated = await db
    .update(conversationMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        ne(conversationMessages.senderId, meId),
        isNull(conversationMessages.readAt),
      ),
    )
    .returning({ id: conversationMessages.id });
  if (updated.length > 0) {
    await publish([otherUserId, meId], { type: "read", conversationId });
  }
}

import "server-only";

import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { conversationMessages, conversations } from "@/db/schema";
import type { CurrentUser } from "@/lib/auth";

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
      .select({
        conversationId: conversationMessages.conversationId,
        body: conversationMessages.body,
      })
      .from(conversationMessages)
      .where(inArray(conversationMessages.conversationId, conversationIds))
      .orderBy(desc(conversationMessages.createdAt))
      .limit(conversationIds.length * 10),
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

  const lastByConv = new Map<string, string>();
  for (const message of recent) {
    if (!lastByConv.has(message.conversationId)) {
      lastByConv.set(message.conversationId, message.body);
    }
  }
  return {
    lastByConv,
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

/** Marque comme lus les messages reçus dans une conversation. */
export async function markConversationRead(
  conversationId: string,
  meId: string,
): Promise<void> {
  await db
    .update(conversationMessages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        ne(conversationMessages.senderId, meId),
        isNull(conversationMessages.readAt),
      ),
    );
}

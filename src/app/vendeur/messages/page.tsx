import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, users } from "@/db/schema";
import {
  ConversationList,
  type ConversationRow,
} from "@/components/messaging/conversation-list";
import { requireApprovedSeller } from "@/lib/auth";
import { conversationSummaries } from "@/lib/messaging";

export default async function VendeurMessagesPage() {
  const user = await requireApprovedSeller();

  const convs = await db
    .select({ conversation: conversations, buyerName: users.fullName })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.buyerId))
    .where(eq(conversations.sellerId, user.sellerProfile.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(50);

  const { lastByConv, unreadByConv } = await conversationSummaries(
    convs.map((c) => c.conversation.id),
    user.id,
  );

  const rows: ConversationRow[] = convs.map((c) => ({
    id: c.conversation.id,
    title: c.buyerName ?? "Acheteur",
    lastBody: lastByConv.get(c.conversation.id) ?? null,
    lastAt: c.conversation.lastMessageAt,
    unread: unreadByConv.get(c.conversation.id) ?? 0,
  }));

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Messages</h1>
        <p className="mt-1 text-ink-muted">
          Vos conversations avec les acheteurs. Répondre vite augmente vos
          ventes.
        </p>
      </div>
      <ConversationList
        rows={rows}
        basePath="/vendeur/messages"
        emptyHint="Aucune conversation : les acheteurs peuvent vous écrire depuis vos fiches produit."
      />
    </main>
  );
}

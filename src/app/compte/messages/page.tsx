import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, sellerProfiles } from "@/db/schema";
import {
  ConversationList,
  type ConversationRow,
} from "@/components/messaging/conversation-list";
import { getCurrentUser } from "@/lib/auth";
import { conversationSummaries } from "@/lib/messaging";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const convs = await db
    .select({ conversation: conversations, shopName: sellerProfiles.shopName })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .where(eq(conversations.buyerId, user.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(50);

  const { lastByConv, unreadByConv } = await conversationSummaries(
    convs.map((c) => c.conversation.id),
    user.id,
  );

  const rows: ConversationRow[] = convs.map((c) => ({
    id: c.conversation.id,
    title: c.shopName,
    lastBody: lastByConv.get(c.conversation.id) ?? null,
    lastAt: c.conversation.lastMessageAt,
    unread: unreadByConv.get(c.conversation.id) ?? 0,
  }));

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Mes messages</h1>
        <p className="mt-1 text-ink-muted">
          Vos conversations avec les boutiques. Contactez un vendeur depuis une
          fiche produit ou une commande.
        </p>
      </div>
      <ConversationList
        rows={rows}
        basePath="/compte/messages"
        emptyHint="Aucune conversation pour le moment. Posez votre première question depuis une fiche produit !"
      />
    </main>
  );
}

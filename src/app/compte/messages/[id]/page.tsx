import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationMessages, conversations, sellerProfiles } from "@/db/schema";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MessageThread } from "@/components/messaging/message-thread";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { markConversationRead } from "@/lib/messaging";

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sujet?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { id } = await params;
  const { sujet } = await searchParams;

  const [row] = await db
    .select({
      conversation: conversations,
      shopName: sellerProfiles.shopName,
      shopStatus: sellerProfiles.status,
    })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row || row.conversation.buyerId !== user.id) notFound();

  await markConversationRead(id, user.id);

  const messages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, id))
    .orderBy(asc(conversationMessages.createdAt))
    .limit(200);

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-6">
        <Link
          href="/compte/messages"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Mes messages
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold">
            {row.shopName}
          </h1>
          {row.shopStatus === "approved" ? (
            <Badge variant="verified">Vendeur vérifié</Badge>
          ) : (
            <Badge variant="neutral">Boutique indisponible</Badge>
          )}
          <Link
            href={`/boutique/${row.conversation.sellerId}`}
            target="_blank"
            rel="noreferrer"
            className="font-label text-sm text-emerald hover:underline"
          >
            Voir la boutique ›
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <MessageThread messages={messages} meId={user.id} />
        <div className="border-t border-white/[0.06] pt-4">
          <MessageComposer conversationId={id} initialBody={sujet ?? ""} />
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-muted">
        Restez sur Deal Lomé pour vos échanges et paiements : c&apos;est votre
        protection en cas de litige.
      </p>
    </main>
  );
}

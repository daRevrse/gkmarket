import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversationMessages, conversations, users } from "@/db/schema";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MessageThread } from "@/components/messaging/message-thread";
import { Card } from "@/components/ui/card";
import { requireApprovedSeller } from "@/lib/auth";
import { markConversationRead } from "@/lib/messaging";

export default async function VendeurConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sujet?: string }>;
}) {
  const user = await requireApprovedSeller();
  const { id } = await params;
  const { sujet } = await searchParams;

  const [row] = await db
    .select({ conversation: conversations, buyerName: users.fullName })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.buyerId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row || row.conversation.sellerId !== user.sellerProfile.id) notFound();

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
          href="/vendeur/messages"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Messages
        </Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold">
          {row.buyerName ?? "Acheteur"}
        </h1>
      </div>

      <Card className="p-4">
        <MessageThread messages={messages} meId={user.id} />
        <div className="border-t border-white/[0.06] pt-4">
          <MessageComposer conversationId={id} initialBody={sujet ?? ""} />
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-muted">
        Restez sur Deal Lomé pour vos échanges : c&apos;est votre protection en
        cas de litige.
      </p>
    </main>
  );
}

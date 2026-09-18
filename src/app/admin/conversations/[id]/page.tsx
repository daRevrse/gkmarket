import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, sellerProfiles, users } from "@/db/schema";
import { MessageThread } from "@/components/messaging/message-thread";
import { Card } from "@/components/ui/card";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";
import { loadThread } from "@/lib/messaging";
import { loadPurchaseOrderViews } from "@/lib/purchase-orders";
import { getPlatformSettings } from "@/lib/settings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lecture d'une conversation par la modération (surveillance
 * anti-contournement). Lecture seule, sans accusé de lecture ; chaque
 * consultation est tracée dans le journal admin.
 */
export default async function AdminConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  const { id } = await params;
  if (!admin?.isAdmin || !UUID_RE.test(id)) notFound();

  const [row] = await db
    .select({
      conversation: conversations,
      shopName: sellerProfiles.shopName,
      sellerUserId: sellerProfiles.userId,
      buyerName: users.fullName,
    })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .innerJoin(users, eq(users.id, conversations.buyerId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row) notFound();

  await logAdmin(admin.id, "Conversation consultée (surveillance)", {
    targetType: "conversation",
    targetId: id,
    details: `${row.buyerName ?? "Acheteur"} et ${row.shopName}`,
  });
  const messages = await loadThread(id);
  const [purchaseOrders, { serviceFeePct }] = await Promise.all([
    loadPurchaseOrderViews(
      messages.flatMap((m) => (m.purchaseOrderId ? [m.purchaseOrderId] : [])),
    ),
    getPlatformSettings(),
  ]);
  const buyerName = row.buyerName ?? "Acheteur";

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-6">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href={`/admin/surveillance/${row.conversation.buyerId}`}
            className="text-ink-muted hover:text-emerald"
          >
            ‹ Acheteur : {buyerName}
          </Link>
          <Link
            href={`/admin/surveillance/${row.sellerUserId}`}
            className="text-ink-muted hover:text-emerald"
          >
            ‹ Vendeur : {row.shopName}
          </Link>
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold">
          {buyerName} et {row.shopName}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Lecture seule par la modération. Cette consultation est enregistrée
          dans le journal.
        </p>
      </div>

      <Card className="p-4">
        <MessageThread
          messages={messages}
          meId={row.sellerUserId}
          conversationId={id}
          viewer="admin"
          purchaseOrders={purchaseOrders}
          serviceFeePct={serviceFeePct}
          senderNames={{
            [row.conversation.buyerId]: buyerName,
            [row.sellerUserId]: row.shopName,
          }}
        />
      </Card>
    </main>
  );
}

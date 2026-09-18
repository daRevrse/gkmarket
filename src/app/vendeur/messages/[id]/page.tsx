import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, users } from "@/db/schema";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MessageThread } from "@/components/messaging/message-thread";
import { PurchaseOrderComposer } from "@/components/messaging/purchase-order-form";
import { Card } from "@/components/ui/card";
import { requireApprovedSeller } from "@/lib/auth";
import { loadThread, markConversationRead } from "@/lib/messaging";
import {
  loadPurchaseOrderViews,
  loadShopCatalog,
  purchaseOrderPrefill,
} from "@/lib/purchase-orders";
import { getPlatformSettings } from "@/lib/settings";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VendeurConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sujet?: string;
    bon?: string;
    produit?: string;
    qte?: string;
    id?: string;
  }>;
}) {
  const user = await requireApprovedSeller();
  const { id } = await params;
  const query = await searchParams;
  const { sujet } = query;
  if (!UUID_RE.test(id)) notFound();

  const [row] = await db
    .select({ conversation: conversations, buyerName: users.fullName })
    .from(conversations)
    .innerJoin(users, eq(users.id, conversations.buyerId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row || row.conversation.sellerId !== user.sellerProfile.id) notFound();

  await markConversationRead(id, user.id, row.conversation.buyerId);
  const [messages, catalog, settings] = await Promise.all([
    loadThread(id),
    loadShopCatalog(user.sellerProfile.id),
    getPlatformSettings(),
  ]);
  const [purchaseOrders, prefill] = await Promise.all([
    loadPurchaseOrderViews(
      messages.flatMap((m) => (m.purchaseOrderId ? [m.purchaseOrderId] : [])),
    ),
    purchaseOrderPrefill(id, catalog, query),
  ]);
  const buyerName = row.buyerName ?? "Acheteur";
  const threadPath = `/vendeur/messages/${id}`;

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
          {buyerName}
        </h1>
      </div>

      <Card className="p-4">
        <MessageThread
          messages={messages}
          meId={user.id}
          conversationId={id}
          otherName={buyerName}
          viewer="seller"
          purchaseOrders={purchaseOrders}
          serviceFeePct={settings.serviceFeePct}
          sellerThreadPath={threadPath}
        />
        <div className="border-t border-white/[0.06] pt-4">
          <div className="mb-3">
            {/* Clé : un nouvel accès (devis, produit, modification) repart à neuf. */}
            <PurchaseOrderComposer
              key={`${query.bon ?? ""}-${query.produit ?? ""}-${query.id ?? ""}-${query.qte ?? ""}`}
              conversationId={id}
              catalog={catalog}
              defaultDeliveryFee={settings.deliveryFeeFcfa}
              serviceFeePct={settings.serviceFeePct}
              prefill={prefill}
            />
          </div>
          <MessageComposer conversationId={id} initialBody={sujet ?? ""} />
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-muted">
        Restez sur Deal Lomé pour vos échanges : c&apos;est votre protection en
        cas de litige. Le partage de numéros, d&apos;emails ou de liens externes
        est bloqué.
      </p>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  conversations,
  productImages,
  products,
  sellerProfiles,
} from "@/db/schema";
import { MessageComposer } from "@/components/messaging/message-composer";
import { MessageThread } from "@/components/messaging/message-thread";
import { ProductInquiryCard } from "@/components/messaging/product-inquiry-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { loadThread, markConversationRead } from "@/lib/messaging";
import { basePriceFcfa } from "@/lib/pricing";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Produit en ligne de la boutique, pour la carte « Se renseigner ». */
async function inquiryProduct(productId: string | undefined, sellerId: string) {
  if (!productId || !UUID_RE.test(productId)) return null;
  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, productId),
        eq(products.sellerId, sellerId),
        eq(products.status, "published"),
      ),
    )
    .limit(1);
  if (!product) return null;
  const [image] = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(eq(productImages.productId, product.id))
    .orderBy(asc(productImages.position))
    .limit(1);
  return {
    id: product.id,
    title: product.title,
    imageUrl: image?.url ?? null,
    priceFcfa: basePriceFcfa(product),
    minOrderQty: product.minOrderQty,
  };
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sujet?: string; produit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { id } = await params;
  const { sujet, produit } = await searchParams;
  if (!UUID_RE.test(id)) notFound();

  const [row] = await db
    .select({
      conversation: conversations,
      shopName: sellerProfiles.shopName,
      shopStatus: sellerProfiles.status,
      sellerUserId: sellerProfiles.userId,
    })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row || row.conversation.buyerId !== user.id) notFound();

  await markConversationRead(id, user.id, row.sellerUserId);

  const [messages, product] = await Promise.all([
    loadThread(id),
    row.shopStatus === "approved"
      ? inquiryProduct(produit, row.conversation.sellerId)
      : null,
  ]);

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
        <MessageThread
          messages={messages}
          meId={user.id}
          conversationId={id}
          otherName={row.shopName}
        />
        <div className="border-t border-white/[0.06] pt-4">
          {product ? (
            <ProductInquiryCard conversationId={id} product={product} />
          ) : null}
          <MessageComposer conversationId={id} initialBody={sujet ?? ""} />
        </div>
      </Card>

      <p className="mt-3 text-xs text-ink-muted">
        Restez sur Deal Lomé pour vos échanges et paiements : c&apos;est votre
        protection en cas de litige. Le partage de numéros, d&apos;emails ou de
        liens externes est bloqué.
      </p>
    </main>
  );
}

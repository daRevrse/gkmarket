import "server-only";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationMessages,
  conversations,
  sellerProfiles,
  type MessageMeta,
} from "@/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { messagePreview } from "@/lib/messaging";
import { notify } from "@/lib/notify";
import { isOnline, publish } from "@/lib/realtime";

// Briques communes aux actions de la messagerie (messages, devis, bons de
// commande). Hors fichier « use server » : ces fonctions ne doivent pas être
// appelables directement depuis le navigateur.

/** Charge une conversation avec l'utilisateur de la boutique. */
export async function getConversation(conversationId: string) {
  const [row] = await db
    .select({
      conversation: conversations,
      sellerUserId: sellerProfiles.userId,
      shopName: sellerProfiles.shopName,
    })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row ?? null;
}

export type ConversationRow = NonNullable<
  Awaited<ReturnType<typeof getConversation>>
>;

export type Party = { user: CurrentUser; row: ConversationRow; isBuyer: boolean };

/** Vérifie que l'utilisateur connecté est l'une des deux parties. */
export async function openAsParty(
  conversationId: string,
): Promise<{ error: string } | Party> {
  const user = await getCurrentUser();
  if (!user) return { error: "Connectez-vous pour envoyer un message." };
  const row = await getConversation(conversationId).catch(() => null);
  if (!row) return { error: "Conversation introuvable." };
  const isBuyer = row.conversation.buyerId === user.id;
  const isSeller = row.sellerUserId === user.id;
  if (!isBuyer && !isSeller) return { error: "Accès refusé." };
  return { user, row, isBuyer };
}

/** Rafraîchit le fil chez les deux parties (temps réel + cache des pages). */
export async function refreshConversation(row: ConversationRow): Promise<void> {
  const conversationId = row.conversation.id;
  await publish([row.conversation.buyerId, row.sellerUserId], {
    type: "message",
    conversationId,
  });
  revalidatePath(`/compte/messages/${conversationId}`);
  revalidatePath(`/vendeur/messages/${conversationId}`);
}

/**
 * Enregistre un message puis prévient : temps réel pour les deux parties
 * (autres onglets compris), notification au destinataire uniquement s'il
 * n'avait aucun message non lu de l'expéditeur (évite le spam) - doublée
 * d'un email s'il n'est pas connecté.
 */
export async function deliver(
  party: Party,
  values: {
    kind: (typeof conversationMessages.$inferInsert)["kind"];
    body: string;
    productId?: string;
    attachmentPath?: string;
    purchaseOrderId?: string;
    meta?: MessageMeta;
  },
): Promise<void> {
  const { user, row, isBuyer } = party;
  const conversationId = row.conversation.id;
  const recipientId = isBuyer ? row.sellerUserId : row.conversation.buyerId;

  const [unread] = await db
    .select({ n: count() })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.senderId, user.id),
        isNull(conversationMessages.readAt),
      ),
    );

  await db.insert(conversationMessages).values({
    conversationId,
    senderId: user.id,
    kind: values.kind,
    body: values.body,
    productId: values.productId ?? null,
    attachmentPath: values.attachmentPath ?? null,
    purchaseOrderId: values.purchaseOrderId ?? null,
    meta: values.meta ?? null,
  });
  await db
    .update(conversations)
    .set({ lastMessageAt: sql`now()` })
    .where(eq(conversations.id, conversationId));

  await publish([recipientId, user.id], { type: "message", conversationId });

  if (unread.n === 0) {
    const preview = messagePreview({
      kind: values.kind ?? "text",
      body: values.body,
      meta: values.meta ?? null,
    });
    await notify(recipientId, {
      type: "message_received",
      title: isBuyer
        ? "Nouveau message d'un acheteur"
        : `Nouveau message de ${row.shopName}`,
      body: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
      link: isBuyer
        ? `/vendeur/messages/${conversationId}`
        : `/compte/messages/${conversationId}`,
      email: !isOnline(recipientId),
    });
  }

  revalidatePath(`/compte/messages/${conversationId}`);
  revalidatePath(`/vendeur/messages/${conversationId}`);
  revalidatePath("/compte/messages");
  revalidatePath("/vendeur/messages");
}

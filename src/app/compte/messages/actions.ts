"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  conversationMessages,
  conversations,
  orders,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

const MAX_BODY = 2000;

/** Charge une conversation avec l'utilisateur de la boutique. */
async function getConversation(conversationId: string) {
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

/** Trouve ou crée la conversation acheteur <-> boutique. */
async function findOrCreateConversation(buyerId: string, sellerId: string) {
  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.buyerId, buyerId),
        eq(conversations.sellerId, sellerId),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const [created] = await db
    .insert(conversations)
    .values({ buyerId, sellerId })
    .onConflictDoNothing()
    .returning({ id: conversations.id });
  if (created) return created.id;
  // Course entre deux requêtes : la conversation vient d'être créée ailleurs.
  const [raced] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.buyerId, buyerId),
        eq(conversations.sellerId, sellerId),
      ),
    )
    .limit(1);
  return raced!.id;
}

/**
 * Envoi d'un message (MVP n°150, 155) : réservé aux deux parties de la
 * conversation. Le destinataire reçoit une notification in-app uniquement
 * s'il n'avait aucun message non lu (évite le spam de notifications).
 */
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Connectez-vous pour envoyer un message." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Votre message est vide." };
  if (trimmed.length > MAX_BODY) {
    return { error: `Message trop long (${MAX_BODY} caractères max).` };
  }

  const row = await getConversation(conversationId);
  if (!row) return { error: "Conversation introuvable." };
  const isBuyer = row.conversation.buyerId === user.id;
  const isSeller = row.sellerUserId === user.id;
  if (!isBuyer && !isSeller) return { error: "Accès refusé." };

  // Le destinataire avait-il déjà des messages non lus ?
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
    body: trimmed,
  });
  await db
    .update(conversations)
    .set({ lastMessageAt: sql`now()` })
    .where(eq(conversations.id, conversationId));

  if (unread.n === 0) {
    const recipientId = isBuyer ? row.sellerUserId : row.conversation.buyerId;
    await notify(recipientId, {
      type: "message_received",
      title: isBuyer
        ? "Nouveau message d'un acheteur"
        : `Nouveau message de ${row.shopName}`,
      body: trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed,
      link: isBuyer
        ? `/vendeur/messages/${conversationId}`
        : `/compte/messages/${conversationId}`,
      email: false,
    });
  }

  revalidatePath(`/compte/messages/${conversationId}`);
  revalidatePath(`/vendeur/messages/${conversationId}`);
  revalidatePath("/compte/messages");
  revalidatePath("/vendeur/messages");
  return {};
}

/**
 * Ouverture d'une conversation avec une boutique depuis une fiche produit ou
 * une commande (côté acheteur). Redirige vers le fil, avec un sujet prérempli.
 */
export async function contactSeller(
  sellerId: string,
  backPath: string,
  sujet?: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(backPath)}`);

  const [seller] = await db
    .select({ id: sellerProfiles.id, userId: sellerProfiles.userId })
    .from(sellerProfiles)
    .where(
      and(eq(sellerProfiles.id, sellerId), eq(sellerProfiles.status, "approved")),
    )
    .limit(1);
  if (!seller) redirect(backPath);
  if (seller.userId === user.id) redirect(backPath); // sa propre boutique

  const conversationId = await findOrCreateConversation(user.id, sellerId);
  redirect(
    `/compte/messages/${conversationId}${sujet ? `?sujet=${encodeURIComponent(sujet)}` : ""}`,
  );
}

/**
 * Ouverture d'une conversation avec l'acheteur d'une commande (côté vendeur,
 * MVP n°150). Redirige vers le fil vendeur.
 */
export async function contactBuyer(orderId: string): Promise<void> {
  const user = await getCurrentUser();
  if (user?.sellerProfile?.status !== "approved") redirect("/vendeur/commandes");

  const [order] = await db
    .select({ buyerId: orders.buyerId, number: orders.number })
    .from(orders)
    .where(
      and(eq(orders.id, orderId), eq(orders.sellerId, user.sellerProfile.id)),
    )
    .limit(1);
  if (!order) redirect("/vendeur/commandes");

  const conversationId = await findOrCreateConversation(
    order.buyerId,
    user.sellerProfile.id,
  );
  redirect(
    `/vendeur/messages/${conversationId}?sujet=${encodeURIComponent(`Au sujet de la commande ${order.number} : `)}`,
  );
}

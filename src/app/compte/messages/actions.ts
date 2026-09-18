"use server";

import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  conversations,
  orders,
  productImages,
  products,
  sellerProfiles,
  type MessageMeta,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { CONTACT_BLOCKED_MESSAGE } from "@/lib/contact-guard";
import { deliver, openAsParty } from "@/lib/conversation-party";
import { adminStorage } from "@/lib/firebase/admin";
import { blockContactInfo } from "@/lib/moderation";
import { basePriceFcfa } from "@/lib/pricing";

const MAX_BODY = 2000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 180;

type SendResult = { error?: string; blocked?: boolean };

/**
 * Envoi d'un message texte (MVP n°150, 155) : réservé aux deux parties de la
 * conversation. Les coordonnées (téléphone, email, liens, autres
 * messageries) bloquent l'envoi et placent l'auteur sous surveillance.
 */
export async function sendMessage(
  conversationId: string,
  body: string,
): Promise<SendResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Votre message est vide." };
  if (trimmed.length > MAX_BODY) {
    return { error: `Message trop long (${MAX_BODY} caractères max).` };
  }

  const party = await openAsParty(conversationId);
  if ("error" in party) return { error: party.error };

  const blocked = await blockContactInfo(party.user.id, trimmed, {
    context: "message",
    conversationId,
  });
  if (blocked) return { error: CONTACT_BLOCKED_MESSAGE, blocked: true };

  await deliver(party, { kind: "text", body: trimmed });
  return {};
}

/**
 * Envoi d'une fiche produit dans le fil (« Se renseigner sur ce produit ») :
 * le produit doit être en ligne et appartenir à la boutique de la
 * conversation. Titre, photo et prix sont figés dans le message.
 */
export async function sendProductCard(
  conversationId: string,
  productId: string,
): Promise<SendResult> {
  const party = await openAsParty(conversationId);
  if ("error" in party) return { error: party.error };

  const [product] = await db
    .select()
    .from(products)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .where(eq(products.id, productId))
    .limit(1)
    .catch(() => []);
  if (
    !product ||
    product.products.sellerId !== party.row.conversation.sellerId ||
    product.products.status !== "published" ||
    product.seller_profiles.status !== "approved"
  ) {
    return { error: "Ce produit n'est plus disponible." };
  }

  const [image] = await db
    .select({ url: productImages.url })
    .from(productImages)
    .where(eq(productImages.productId, productId))
    .orderBy(asc(productImages.position))
    .limit(1);

  await deliver(party, {
    kind: "product",
    body: "",
    productId,
    meta: {
      product: {
        title: product.products.title,
        imageUrl: image?.url ?? null,
        priceFcfa: basePriceFcfa(product.products),
        minOrderQty: product.products.minOrderQty,
      },
    },
  });
  return {};
}

export type AttachmentInput = {
  /** Chemin Storage déjà envoyé par le client : chat/{firebaseUid}/... */
  path: string;
  kind: "image" | "file" | "audio";
  /** Nom d'origine du fichier (documents). */
  name?: string;
  /** Durée d'un message vocal, en secondes. */
  durationSec?: number;
};

/**
 * Envoi d'une pièce jointe (photo, PDF) ou d'un message vocal. Le fichier a
 * été déposé par le client dans son dossier Storage privé ; le serveur en
 * relit le type et la taille réels avant de l'accepter.
 */
export async function sendAttachment(
  conversationId: string,
  input: AttachmentInput,
): Promise<SendResult> {
  const party = await openAsParty(conversationId);
  if ("error" in party) return { error: party.error };

  const prefix = `chat/${party.user.firebaseUid}/`;
  if (!input.path.startsWith(prefix) || input.path.includes("..")) {
    return { error: "Fichier invalide." };
  }

  let contentType = "";
  let size = 0;
  try {
    const [metadata] = await adminStorage.bucket().file(input.path).getMetadata();
    contentType = metadata.contentType ?? "";
    size = Number(metadata.size ?? 0);
  } catch {
    return { error: "Fichier introuvable : réessayez l'envoi." };
  }
  if (size <= 0 || size > MAX_ATTACHMENT_BYTES) {
    return { error: "Fichier trop volumineux (10 Mo max)." };
  }

  const typeOk =
    (input.kind === "image" && /^image\/(jpeg|png|webp|gif)$/.test(contentType)) ||
    (input.kind === "file" && contentType === "application/pdf") ||
    (input.kind === "audio" && contentType.startsWith("audio/"));
  if (!typeOk) {
    return { error: "Format non accepté : photos, PDF ou messages vocaux." };
  }

  const meta: MessageMeta = {
    file: {
      name: (input.name ?? "fichier").slice(0, 120),
      size,
      contentType,
    },
  };
  if (input.kind === "audio") {
    const duration = Math.round(Number(input.durationSec) || 0);
    if (duration < 1 || duration > MAX_AUDIO_SECONDS) {
      return { error: "Message vocal invalide (3 minutes max)." };
    }
    meta.audio = { durationSec: duration };
  }

  await deliver(party, {
    kind: input.kind,
    body: "",
    attachmentPath: input.path,
    meta,
  });
  return {};
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
 * Ouverture d'une conversation avec une boutique depuis une fiche produit ou
 * une commande (côté acheteur). Redirige vers le fil : avec la fiche produit
 * prête à envoyer, ou un sujet prérempli.
 */
export async function contactSeller(
  sellerId: string,
  backPath: string,
  context?: { productId?: string; sujet?: string },
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
  const query = context?.productId
    ? `?produit=${encodeURIComponent(context.productId)}`
    : context?.sujet
      ? `?sujet=${encodeURIComponent(context.sujet)}`
      : "";
  redirect(`/compte/messages/${conversationId}${query}`);
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

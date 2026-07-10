"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  deliveries,
  orderItems,
  orders,
  products,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { renderTransactionalEmail, sendEmail } from "@/lib/email";
import { releaseEscrowForOrder } from "@/lib/escrow";
import { formatFcfa } from "@/lib/format";
import { generateInvoicePdf } from "@/lib/invoice";
import { notify } from "@/lib/notify";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

/**
 * Envoie la facture PDF en pièce jointe à l'acheteur (MVP n°123). Jamais
 * bloquant : un échec d'email ne doit pas casser le paiement.
 */
async function emailInvoice(
  order: typeof orders.$inferSelect,
  toEmail: string,
): Promise<void> {
  try {
    const [shop] = await db
      .select({ shopName: sellerProfiles.shopName, shopCity: sellerProfiles.city })
      .from(sellerProfiles)
      .where(eq(sellerProfiles.id, order.sellerId))
      .limit(1);
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    const pdf = await generateInvoicePdf({
      order,
      items,
      shopName: shop?.shopName ?? "Deal Lomé",
      shopCity: shop?.shopCity ?? "Lomé",
    });
    const { text, html } = renderTransactionalEmail({
      title: `Facture ${order.number}`,
      body: `Votre paiement de ${formatFcfa(order.totalFcfa)} est confirmé et sécurisé jusqu'à la réception. Votre facture est jointe à cet email (PDF).`,
      link: `/compte/commandes/${order.id}`,
    });
    await sendEmail({
      toEmail,
      subject: `Deal Lomé - Facture ${order.number}`,
      bodyText: text,
      bodyHtml: html,
      attachments: [
        {
          name: `facture-${order.number}.pdf`,
          contentBase64: Buffer.from(pdf).toString("base64"),
        },
      ],
    });
  } catch {
    // Génération/envoi facture indisponible : on n'interrompt pas le paiement.
  }
}

async function sellerUserId(sellerProfileId: string): Promise<string | null> {
  const [seller] = await db
    .select({ userId: sellerProfiles.userId })
    .from(sellerProfiles)
    .where(eq(sellerProfiles.id, sellerProfileId))
    .limit(1);
  return seller?.userId ?? null;
}

function revalidateOrderPaths(orderId: string) {
  revalidatePath("/compte/commandes");
  revalidatePath(`/compte/commandes/${orderId}`);
  revalidatePath("/vendeur/commandes");
  revalidatePath("/livreur/courses");
  revalidatePath("/compte/wallet");
}

async function getOwnOrder(userId: string, orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.buyerId, userId)))
    .limit(1);
  return order ?? null;
}

/** Paiement wallet : fonds débités et bloqués en Escrow (MVP n°115-116). */
export async function payOrder(orderId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const order = await getOwnOrder(user.id, orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "pending_payment") {
    return { error: "Cette commande n'est pas en attente de paiement." };
  }

  const wallet = await getOrCreateWallet(user.id);
  if (wallet.balanceFcfa < order.totalFcfa) {
    return {
      error: `Solde insuffisant : ${formatFcfa(wallet.balanceFcfa)} disponibles, ${formatFcfa(order.totalFcfa)} requis. Rechargez votre wallet.`,
    };
  }

  let ok = false;
  await db.transaction(async (tx) => {
    ok = await applyWalletMovement(tx, wallet.id, {
      type: "order_payment",
      amountFcfa: -order.totalFcfa,
      orderId: order.id,
      description: `Paiement commande ${order.number} (paiement sécurisé)`,
    });
    if (!ok) return;
    await tx
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, "pending_payment")));
  });
  if (!ok) return { error: "Solde insuffisant. Rechargez votre wallet." };

  // Le vendeur sait que les fonds sont sécurisés (MVP n°304).
  const sellerUid = await sellerUserId(order.sellerId);
  if (sellerUid) {
    await notify(sellerUid, {
      type: "order_paid",
      title: `Paiement reçu et sécurisé - ${order.number}`,
      body: `${formatFcfa(order.totalFcfa)} sécurisés. Préparez la commande.`,
      link: "/vendeur/commandes",
      email: true,
    });
  }
  // Reçu de paiement pour l'acheteur (in-app). L'email part avec la facture
  // PDF en pièce jointe (MVP n°123).
  await notify(user.id, {
    type: "order_paid_receipt",
    title: `Paiement de ${order.number} confirmé`,
    body: `${formatFcfa(order.totalFcfa)} débités de votre wallet et sécurisés jusqu'à la réception. Votre facture est jointe à l'email de confirmation.`,
    link: `/compte/commandes/${order.id}`,
    email: false,
  });
  if (user.email) await emailInvoice({ ...order, status: "paid", paidAt: new Date() }, user.email);

  revalidateOrderPaths(orderId);
  return {};
}

/**
 * Annulation possible tant que la commande n'est pas expédiée
 * (MVP n°126) : remboursement wallet si déjà payée, et re-stock.
 */
export async function cancelOrder(orderId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const order = await getOwnOrder(user.id, orderId);
  if (!order) return { error: "Commande introuvable." };
  if (order.status !== "pending_payment" && order.status !== "paid") {
    return { error: "Cette commande ne peut plus être annulée (déjà en traitement)." };
  }

  const wallet = await getOrCreateWallet(user.id);

  await db.transaction(async (tx) => {
    // Verrou optimiste : seul le statut courant est annulable.
    const updated = await tx
      .update(orders)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
      .returning({ id: orders.id });
    if (updated.length === 0) throw new Error("conflict");

    if (order.status === "paid") {
      await applyWalletMovement(tx, wallet.id, {
        type: "order_refund",
        amountFcfa: order.totalFcfa,
        orderId: order.id,
        description: `Remboursement commande ${order.number} annulée`,
      });
    }

    // Une course encore non récupérée est annulée avec la commande.
    await tx
      .update(deliveries)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(deliveries.orderId, order.id),
          inArray(deliveries.status, ["proposed", "accepted"]),
        ),
      );

    // Re-stock des articles dont le produit existe encore
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      if (item.productId) {
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }
    }
  });

  const sellerUid = await sellerUserId(order.sellerId);
  if (sellerUid) {
    await notify(sellerUid, {
      type: "order_cancelled",
      title: `Commande ${order.number} annulée par l'acheteur`,
      body:
        order.status === "paid"
          ? "L'acheteur a été remboursé, le stock est restitué."
          : "Le stock est restitué.",
      link: "/vendeur/commandes",
      email: true,
    });
  }

  revalidateOrderPaths(orderId);
  revalidatePath("/produits");
  return {};
}

/**
 * Confirmation de réception par l'acheteur : déblocage de l'Escrow,
 * versement au vendeur net de commission (MVP n°118, 121) et frais de
 * course au livreur (itération 6). La logique de versement est partagée
 * avec le déblocage automatique (src/lib/escrow.ts).
 */
export async function confirmDelivery(
  orderId: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const order = await getOwnOrder(user.id, orderId);
  if (!order) return { error: "Commande introuvable." };

  const result = await releaseEscrowForOrder(order.id, "confirmed");
  if (result.error) return result;

  revalidateOrderPaths(orderId);
  return {};
}

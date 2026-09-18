"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  cartItems,
  conversations,
  orderItems,
  orders,
  productImages,
  products,
  purchaseOrders,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { notify } from "@/lib/notify";
import { feeFromPct, type CheckoutSource } from "@/lib/orders";
import { unitPriceFcfa } from "@/lib/pricing";
import { loadAcceptablePurchaseOrder } from "@/lib/purchase-orders";
import { publish } from "@/lib/realtime";
import { getPlatformSettings } from "@/lib/settings";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

function generateOrderNumber(): string {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DL-${date}-${suffix}`;
}

/** Ligne à commander, prix unitaire déjà arrêté (catalogue ou négocié). */
type OrderLine = {
  /** Null pour une ligne libre de bon de commande (pas de stock). */
  productId: string | null;
  title: string;
  imageUrl: string | null;
  sellerId: string;
  quantity: number;
  unitPriceFcfa: number;
};

type Prepared =
  | { error: string }
  | {
      lines: OrderLine[];
      /** Frais de livraison par commande (vendeur). */
      deliveryFeeFcfa: number;
      purchaseOrder?: { id: string; number: string; conversationId: string };
    };

/**
 * Lignes du panier ou d'un achat direct : produits en ligne, stock et
 * quantité minimum vérifiés, prix de gros/promo appliqués.
 */
async function prepareCatalogLines(
  userId: string,
  direct: { productId: string; quantity: number } | null,
  deliveryFeeFcfa: number,
): Promise<Prepared> {
  if (direct && (!Number.isInteger(direct.quantity) || direct.quantity < 1)) {
    return { error: "Quantité invalide." };
  }

  const lineSelection = {
    product: products,
    imageUrl: productImages.url,
    sellerStatus: sellerProfiles.status,
  };
  const mainImage = and(
    eq(productImages.productId, products.id),
    eq(productImages.position, 0),
  );

  const rows = direct
    ? (
        await db
          .select(lineSelection)
          .from(products)
          .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
          .leftJoin(productImages, mainImage)
          .where(eq(products.id, direct.productId))
          .limit(1)
          .catch(() => [])
      ).map((row) => ({ ...row, quantity: direct.quantity }))
    : await db
        .select({ ...lineSelection, quantity: cartItems.quantity })
        .from(cartItems)
        .innerJoin(products, eq(products.id, cartItems.productId))
        .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
        .leftJoin(productImages, mainImage)
        .where(eq(cartItems.userId, userId));

  if (rows.length === 0) {
    return { error: direct ? "Produit indisponible." : "Votre panier est vide." };
  }

  for (const { product, sellerStatus, quantity } of rows) {
    if (product.status !== "published" || sellerStatus !== "approved") {
      return {
        error: `« ${product.title} » n'est plus disponible${direct ? "." : " - retirez-le du panier."}`,
      };
    }
    if (quantity > product.stock) {
      return {
        error: `Stock insuffisant pour « ${product.title} » (${product.stock} restant${product.stock > 1 ? "s" : ""}).`,
      };
    }
    if (quantity < product.minOrderQty) {
      return {
        error: `Quantité minimum de ${product.minOrderQty} pour « ${product.title} ».`,
      };
    }
  }

  return {
    deliveryFeeFcfa,
    lines: rows.map(({ product, imageUrl, quantity }) => ({
      productId: product.id,
      title: product.title,
      imageUrl,
      sellerId: product.sellerId,
      quantity,
      unitPriceFcfa: unitPriceFcfa(product, quantity),
    })),
  };
}

/**
 * Lignes d'un bon de commande accepté : prix et livraison négociés, stock
 * vérifié pour les produits du catalogue (le minimum de commande ne
 * s'applique pas, le vendeur ayant fixé les quantités).
 */
async function preparePurchaseOrderLines(
  userId: string,
  purchaseOrderId: string,
): Promise<Prepared> {
  const loaded = await loadAcceptablePurchaseOrder(purchaseOrderId, userId);
  if ("error" in loaded) return { error: loaded.error ?? "Bon de commande invalide." };
  const { po, items } = loaded;

  const productIds = items.flatMap((item) => (item.productId ? [item.productId] : []));
  const stocks = new Map(
    productIds.length > 0
      ? (
          await db
            .select({ id: products.id, stock: products.stock })
            .from(products)
            .where(inArray(products.id, productIds))
        ).map((row) => [row.id, row.stock])
      : [],
  );
  for (const item of items) {
    if (item.productId && (stocks.get(item.productId) ?? 0) < item.quantity) {
      return {
        error: `Stock insuffisant pour « ${item.title} » : demandez au vendeur d'ajuster le bon de commande.`,
      };
    }
  }

  return {
    deliveryFeeFcfa: po.deliveryFeeFcfa,
    purchaseOrder: { id: po.id, number: po.number, conversationId: po.conversationId },
    lines: items.map((item) => ({
      productId: item.productId,
      title: item.title,
      imageUrl: item.imageUrl,
      sellerId: po.sellerId,
      quantity: item.quantity,
      unitPriceFcfa: item.unitPriceFcfa,
    })),
  };
}

/**
 * Crée les commandes (une par vendeur, MVP n°101-102) du panier, d'un achat
 * direct (« Acheter maintenant », panier intact) ou d'un bon de commande
 * accepté. Chaque commande porte les frais de service acheteur
 * (docs/CHANGEMENTS.md §5) ; le paiement wallet est immédiat et sécurisé.
 */
export async function createOrder(
  addressId: string,
  payWithWallet: boolean,
  source?: CheckoutSource,
): Promise<{ error?: string; groupId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)))
    .limit(1);
  if (!address) return { error: "Choisissez une adresse de livraison." };

  const settings = await getPlatformSettings();
  const prepared =
    source?.kind === "purchase_order"
      ? await preparePurchaseOrderLines(user.id, source.purchaseOrderId)
      : await prepareCatalogLines(
          user.id,
          source?.kind === "direct" ? source : null,
          settings.deliveryFeeFcfa,
        );
  if ("error" in prepared) return { error: prepared.error };
  const { lines, deliveryFeeFcfa, purchaseOrder } = prepared;

  const groupId = randomUUID();
  const wallet = payWithWallet ? await getOrCreateWallet(user.id) : null;
  const createdOrders: {
    id: string;
    number: string;
    sellerId: string;
    total: number;
  }[] = [];

  try {
    await db.transaction(async (tx) => {
      const bySeller = new Map<string, OrderLine[]>();
      for (const line of lines) {
        bySeller.set(line.sellerId, [...(bySeller.get(line.sellerId) ?? []), line]);
      }

      for (const [sellerId, sellerLines] of bySeller) {
        const subtotal = sellerLines.reduce(
          (sum, line) => sum + line.unitPriceFcfa * line.quantity,
          0,
        );
        const serviceFee = feeFromPct(subtotal, settings.serviceFeePct);
        const total = subtotal + deliveryFeeFcfa + serviceFee;
        const number = generateOrderNumber();
        const [order] = await tx
          .insert(orders)
          .values({
            number,
            groupId,
            buyerId: user.id,
            sellerId,
            // Paiement wallet immédiat : fonds débités et bloqués en Escrow
            status: wallet ? "paid" : "pending_payment",
            paidAt: wallet ? new Date() : null,
            shippingName: address.recipientName,
            shippingPhone: address.recipientPhone,
            shippingCity: address.city,
            shippingDistrict: address.district,
            shippingDetails: address.details,
            subtotalFcfa: subtotal,
            deliveryFeeFcfa,
            serviceFeeFcfa: serviceFee,
            totalFcfa: total,
          })
          .returning({ id: orders.id });

        if (wallet) {
          const ok = await applyWalletMovement(tx, wallet.id, {
            type: "order_payment",
            amountFcfa: -total,
            orderId: order.id,
            description: `Paiement commande ${number} (paiement sécurisé)`,
          });
          if (!ok) throw new Error("wallet");
        }
        createdOrders.push({ id: order.id, number, sellerId, total });

        await tx.insert(orderItems).values(
          sellerLines.map((line) => ({
            orderId: order.id,
            productId: line.productId,
            title: line.title,
            imageUrl: line.imageUrl,
            unitPriceFcfa: line.unitPriceFcfa,
            quantity: line.quantity,
            totalFcfa: line.unitPriceFcfa * line.quantity,
          })),
        );

        // Décrément du stock, garanti par le WHERE (échoue si le stock a
        // changé entre la vérification et maintenant).
        for (const line of sellerLines) {
          if (!line.productId) continue;
          const updated = await tx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${line.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(products.id, line.productId),
                sql`${products.stock} >= ${line.quantity}`,
              ),
            )
            .returning({ id: products.id });
          if (updated.length === 0) {
            throw new Error(`stock:${line.title}`);
          }
        }

        // Bon de commande : accepté une seule fois, avant son échéance.
        if (purchaseOrder) {
          const accepted = await tx
            .update(purchaseOrders)
            .set({ status: "accepted", orderId: order.id, respondedAt: new Date() })
            .where(
              and(
                eq(purchaseOrders.id, purchaseOrder.id),
                eq(purchaseOrders.status, "sent"),
                gt(purchaseOrders.expiresAt, new Date()),
              ),
            )
            .returning({ id: purchaseOrders.id });
          if (accepted.length === 0) throw new Error("purchase_order");
        }
      }

      // Seul un passage par le panier le vide.
      if (!source) {
        await tx.delete(cartItems).where(eq(cartItems.userId, user.id));
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("stock:")) {
      return {
        error: `Stock insuffisant pour « ${message.slice(6)} » - un autre acheteur est passé avant vous.`,
      };
    }
    if (message === "wallet") {
      return {
        error: `Solde wallet insuffisant (${formatFcfa(wallet?.balanceFcfa ?? 0)} disponibles). Rechargez votre wallet ou choisissez « Payer plus tard ».`,
      };
    }
    if (message === "purchase_order") {
      return { error: "Ce bon de commande n'est plus valable." };
    }
    console.error("Création de commande échouée:", err);
    return { error: "La commande a échoué. Réessayez." };
  }

  // Notifications après commit (MVP n°143, 151, 303-304) - jamais bloquantes.
  const sellerRows = await db
    .select({ id: sellerProfiles.id, userId: sellerProfiles.userId })
    .from(sellerProfiles)
    .where(
      inArray(sellerProfiles.id, [
        ...new Set(createdOrders.map((order) => order.sellerId)),
      ]),
    );
  const sellerUser = new Map(sellerRows.map((row) => [row.id, row.userId]));
  for (const order of createdOrders) {
    const sellerUserId = sellerUser.get(order.sellerId);
    if (sellerUserId) {
      await notify(sellerUserId, {
        type: "order_new",
        title: purchaseOrder
          ? `Bon de commande ${purchaseOrder.number} accepté : commande ${order.number}`
          : `Nouvelle commande ${order.number}`,
        body: wallet
          ? `${formatFcfa(order.total)} reçus et sécurisés - préparez la commande.`
          : `Commande de ${formatFcfa(order.total)} en attente de paiement.`,
        link: "/vendeur/commandes",
        email: true,
      });
    }
  }
  await notify(user.id, {
    type: "order_confirmed",
    title:
      createdOrders.length > 1
        ? `Vos ${createdOrders.length} commandes sont enregistrées`
        : `Votre commande ${createdOrders[0]?.number ?? ""} est enregistrée`,
    body: wallet
      ? "Paiement effectué - les fonds sont sécurisés jusqu'à la réception. Votre facture PDF est disponible depuis le détail de chaque commande."
      : "Payez depuis le détail de la commande pour lancer la préparation.",
    link: "/compte/commandes",
    // Reçu par email quand le paiement est immédiat (MVP n°123)
    email: Boolean(wallet),
  });

  // La carte du bon dans le chat passe à « Accepté » chez les deux parties.
  if (purchaseOrder) {
    const [conversation] = await db
      .select({ sellerUserId: sellerProfiles.userId })
      .from(conversations)
      .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
      .where(eq(conversations.id, purchaseOrder.conversationId))
      .limit(1);
    await publish(
      [user.id, ...(conversation ? [conversation.sellerUserId] : [])],
      { type: "message", conversationId: purchaseOrder.conversationId },
    );
    revalidatePath(`/compte/messages/${purchaseOrder.conversationId}`);
  }

  revalidatePath("/panier");
  revalidatePath("/compte/commandes");
  revalidatePath("/produits");
  return { groupId };
}

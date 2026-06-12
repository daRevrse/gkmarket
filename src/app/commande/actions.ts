"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  cartItems,
  orderItems,
  orders,
  productImages,
  products,
  sellerProfiles,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { notify } from "@/lib/notify";
import { DELIVERY_FEE_PER_SELLER_FCFA, unitPriceFcfa } from "@/lib/pricing";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

function generateOrderNumber(): string {
  const now = new Date();
  const date = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `GK-${date}-${suffix}`;
}

export async function createOrder(
  addressId: string,
  payWithWallet: boolean,
): Promise<{ error?: string; groupId?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const [address] = await db
    .select()
    .from(addresses)
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, user.id)))
    .limit(1);
  if (!address) return { error: "Choisissez une adresse de livraison." };

  const lines = await db
    .select({
      item: cartItems,
      product: products,
      imageUrl: productImages.url,
      sellerStatus: sellerProfiles.status,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .leftJoin(
      productImages,
      and(
        eq(productImages.productId, products.id),
        eq(productImages.position, 0),
      ),
    )
    .where(eq(cartItems.userId, user.id));

  if (lines.length === 0) return { error: "Votre panier est vide." };

  for (const line of lines) {
    if (line.product.status !== "published" || line.sellerStatus !== "approved") {
      return { error: `« ${line.product.title} » n'est plus disponible — retirez-le du panier.` };
    }
    if (line.item.quantity > line.product.stock) {
      return {
        error: `Stock insuffisant pour « ${line.product.title} » (${line.product.stock} restant${line.product.stock > 1 ? "s" : ""}).`,
      };
    }
    if (line.item.quantity < line.product.minOrderQty) {
      return {
        error: `Quantité minimum de ${line.product.minOrderQty} pour « ${line.product.title} ».`,
      };
    }
  }

  const groupId = randomUUID();
  const wallet = payWithWallet ? await getOrCreateWallet(user.id) : null;
  const createdOrders: { number: string; sellerId: string; total: number }[] =
    [];

  try {
    await db.transaction(async (tx) => {
      // Une commande par vendeur (MVP n°101-102)
      const bySeller = new Map<string, typeof lines>();
      for (const line of lines) {
        const list = bySeller.get(line.product.sellerId) ?? [];
        list.push(line);
        bySeller.set(line.product.sellerId, list);
      }

      for (const [sellerId, sellerLines] of bySeller) {
        const subtotal = sellerLines.reduce(
          (sum, line) =>
            sum + unitPriceFcfa(line.product, line.item.quantity) * line.item.quantity,
          0,
        );

        const total = subtotal + DELIVERY_FEE_PER_SELLER_FCFA;
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
            deliveryFeeFcfa: DELIVERY_FEE_PER_SELLER_FCFA,
            totalFcfa: total,
          })
          .returning({ id: orders.id });

        if (wallet) {
          const ok = await applyWalletMovement(tx, wallet.id, {
            type: "order_payment",
            amountFcfa: -total,
            orderId: order.id,
            description: `Paiement commande ${number} (fonds en Escrow)`,
          });
          if (!ok) throw new Error("wallet");
        }
        createdOrders.push({ number, sellerId, total });

        await tx.insert(orderItems).values(
          sellerLines.map((line) => {
            const unitPrice = unitPriceFcfa(line.product, line.item.quantity);
            return {
              orderId: order.id,
              productId: line.product.id,
              title: line.product.title,
              imageUrl: line.imageUrl,
              unitPriceFcfa: unitPrice,
              quantity: line.item.quantity,
              totalFcfa: unitPrice * line.item.quantity,
            };
          }),
        );

        // Décrément du stock, garanti par le WHERE (échoue si le stock a
        // changé entre la vérification et maintenant).
        for (const line of sellerLines) {
          const updated = await tx
            .update(products)
            .set({
              stock: sql`${products.stock} - ${line.item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(products.id, line.product.id),
                sql`${products.stock} >= ${line.item.quantity}`,
              ),
            )
            .returning({ id: products.id });
          if (updated.length === 0) {
            throw new Error(`stock:${line.product.title}`);
          }
        }
      }

      await tx.delete(cartItems).where(eq(cartItems.userId, user.id));
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.startsWith("stock:")) {
      return {
        error: `Stock insuffisant pour « ${message.slice(6)} » — un autre acheteur est passé avant vous.`,
      };
    }
    if (message === "wallet") {
      return {
        error: `Solde wallet insuffisant (${formatFcfa(wallet?.balanceFcfa ?? 0)} disponibles). Rechargez votre wallet ou choisissez « Payer plus tard ».`,
      };
    }
    console.error("Création de commande échouée:", err);
    return { error: "La commande a échoué. Réessayez." };
  }

  // Notifications après commit (MVP n°143, 151, 303-304) — jamais bloquantes.
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
        title: `Nouvelle commande ${order.number}`,
        body: wallet
          ? `${formatFcfa(order.total)} reçus en Escrow — préparez la commande.`
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
      ? "Paiement effectué — les fonds sont bloqués en Escrow jusqu'à la réception."
      : "Payez depuis le détail de la commande pour lancer la préparation.",
    link: "/compte/commandes",
  });

  revalidatePath("/panier");
  revalidatePath("/compte/commandes");
  revalidatePath("/produits");
  return { groupId };
}

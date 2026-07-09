"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, products, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { readGuestCart, writeGuestCart } from "@/lib/guest-cart";

type ActionResult = { error?: string };

function clampQuantity(quantity: number, minOrderQty: number, stock: number) {
  return Math.max(minOrderQty, Math.min(quantity, stock));
}

/** Produit achetable (publié, boutique approuvée) ou null. */
async function loadPurchasableProduct(productId: string) {
  const [row] = await db
    .select({ product: products, sellerStatus: sellerProfiles.status })
    .from(products)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, products.sellerId))
    .where(and(eq(products.id, productId), eq(products.status, "published")))
    .limit(1);
  if (!row || row.sellerStatus !== "approved") return null;
  return row.product;
}

export async function addToCart(
  productId: string,
  quantity: number,
): Promise<ActionResult> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: "Quantité invalide." };
  }
  const product = await loadPurchasableProduct(productId);
  if (!product) return { error: "Produit indisponible." };
  if (product.stock === 0) return { error: "Produit en rupture de stock." };

  const requested = clampQuantity(quantity, product.minOrderQty, product.stock);
  const user = await getCurrentUser();

  if (user) {
    await db
      .insert(cartItems)
      .values({ userId: user.id, productId, quantity: requested })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: {
          // Ré-ajout du même produit : on additionne, plafonné au stock.
          quantity: sql`LEAST(${cartItems.quantity} + ${requested}, ${product.stock})`,
          updatedAt: sql`now()`,
        },
      });
  } else {
    // Panier invité : dans le cookie.
    const items = await readGuestCart();
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + requested, product.stock);
    } else {
      items.push({ productId, quantity: requested });
    }
    await writeGuestCart(items);
  }

  revalidatePath("/panier");
  return {};
}

export async function updateCartQuantity(
  itemId: string,
  quantity: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (user) {
    const [row] = await db
      .select({ item: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, user.id)))
      .limit(1);
    if (!row) return { error: "Article introuvable." };

    if (!Number.isInteger(quantity) || quantity < 1) {
      await db.delete(cartItems).where(eq(cartItems.id, itemId));
    } else {
      await db
        .update(cartItems)
        .set({
          quantity: clampQuantity(
            quantity,
            row.product.minOrderQty,
            row.product.stock,
          ),
          updatedAt: new Date(),
        })
        .where(eq(cartItems.id, itemId));
    }
  } else {
    // Invité : itemId == productId dans le cookie.
    const items = await readGuestCart();
    const existing = items.find((i) => i.productId === itemId);
    if (!existing) return { error: "Article introuvable." };
    if (!Number.isInteger(quantity) || quantity < 1) {
      await writeGuestCart(items.filter((i) => i.productId !== itemId));
    } else {
      const product = await loadPurchasableProduct(itemId);
      existing.quantity = product
        ? clampQuantity(quantity, product.minOrderQty, product.stock)
        : quantity;
      await writeGuestCart(items);
    }
  }

  revalidatePath("/panier");
  return {};
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (user) {
    await db
      .delete(cartItems)
      .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, user.id)));
  } else {
    const items = await readGuestCart();
    await writeGuestCart(items.filter((i) => i.productId !== itemId));
  }

  revalidatePath("/panier");
  return {};
}

export async function clearCart(): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (user) {
    await db.delete(cartItems).where(eq(cartItems.userId, user.id));
  } else {
    await writeGuestCart([]);
  }

  revalidatePath("/panier");
  return {};
}

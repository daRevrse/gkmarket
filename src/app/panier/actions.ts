"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, products } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

type ActionResult = { error?: string; authRequired?: boolean };

function clampQuantity(quantity: number, minOrderQty: number, stock: number) {
  return Math.max(minOrderQty, Math.min(quantity, stock));
}

export async function addToCart(
  productId: string,
  quantity: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { authRequired: true };

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.status, "published")))
    .limit(1);
  if (!product) return { error: "Produit indisponible." };
  if (product.stock === 0) return { error: "Produit en rupture de stock." };
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { error: "Quantité invalide." };
  }

  const requested = clampQuantity(quantity, product.minOrderQty, product.stock);

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

  revalidatePath("/panier");
  return {};
}

export async function updateCartQuantity(
  itemId: string,
  quantity: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { authRequired: true };

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
        quantity: clampQuantity(quantity, row.product.minOrderQty, row.product.stock),
        updatedAt: new Date(),
      })
      .where(eq(cartItems.id, itemId));
  }

  revalidatePath("/panier");
  return {};
}

export async function removeCartItem(itemId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { authRequired: true };

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, user.id)));

  revalidatePath("/panier");
  return {};
}

export async function clearCart(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { authRequired: true };

  await db.delete(cartItems).where(eq(cartItems.userId, user.id));
  revalidatePath("/panier");
  return {};
}

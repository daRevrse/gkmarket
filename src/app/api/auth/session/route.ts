import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, products, sellerProfiles, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { clearGuestCart, readGuestCart } from "@/lib/guest-cart";
import { isPhoneAliasEmail } from "@/lib/phone";

/**
 * Fusionne le panier invité (cookie) dans le panier en base de l'utilisateur
 * qui vient de se connecter : additionne les quantités, plafonné au stock,
 * en ignorant les produits devenus indisponibles.
 */
async function mergeGuestCart(userId: string): Promise<void> {
  const guest = await readGuestCart();
  if (guest.length === 0) return;

  const rows = await db
    .select({ id: products.id, stock: products.stock })
    .from(products)
    .innerJoin(
      sellerProfiles,
      and(
        eq(sellerProfiles.id, products.sellerId),
        eq(sellerProfiles.status, "approved"),
      ),
    )
    .where(eq(products.status, "published"));
  const stockById = new Map(rows.map((r) => [r.id, r.stock]));

  for (const item of guest) {
    const stock = stockById.get(item.productId);
    if (!stock || stock <= 0) continue;
    const qty = Math.min(item.quantity, stock);
    await db
      .insert(cartItems)
      .values({ userId, productId: item.productId, quantity: qty })
      .onConflictDoUpdate({
        target: [cartItems.userId, cartItems.productId],
        set: {
          quantity: sql`LEAST(${cartItems.quantity} + ${qty}, ${stock})`,
          updatedAt: sql`now()`,
        },
      });
  }
  await clearGuestCart();
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5; // 5 jours

/**
 * Échange un ID token Firebase (obtenu côté client après connexion/inscription)
 * contre un cookie de session httpOnly, et synchronise l'utilisateur en base.
 */
export async function POST(request: NextRequest) {
  const { idToken, fullName } = (await request.json()) as {
    idToken?: string;
    fullName?: string;
  };
  if (!idToken) {
    return NextResponse.json({ error: "idToken manquant" }, { status: 400 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // L'identifiant interne dérivé du téléphone n'est pas un vrai email.
    const email = isPhoneAliasEmail(decoded.email) ? null : (decoded.email ?? null);

    const [row] = await db
      .insert(users)
      .values({
        firebaseUid: decoded.uid,
        email,
        phone: decoded.phone_number ?? null,
        fullName: fullName ?? decoded.name ?? null,
      })
      .onConflictDoUpdate({
        target: users.firebaseUid,
        set: {
          email,
          phone: decoded.phone_number ?? null,
          ...(fullName ? { fullName } : {}),
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: users.id });

    // Récupère le panier constitué avant connexion.
    if (row) await mergeGuestCart(row.id);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS / 1000,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

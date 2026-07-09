import "server-only";

import { cookies } from "next/headers";

/**
 * Panier « invité » : avant connexion, le panier vit dans un cookie plutôt
 * qu'en base. On ne demande l'authentification qu'à la validation de la
 * commande (cf. /commande), pour ne pas casser l'expérience d'achat du
 * visiteur. À la connexion, ce panier est fusionné dans la base
 * (src/app/api/auth/session/route.ts) puis le cookie est vidé.
 */
export const GUEST_CART_COOKIE = "guest_cart";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 jours
const MAX_LINES = 50; // garde-fou anti-cookie géant

export type GuestCartItem = { productId: string; quantity: number };

/** Lecture - utilisable partout (server components inclus). */
export async function readGuestCart(): Promise<GuestCartItem[]> {
  const raw = (await cookies()).get(GUEST_CART_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is { p: string; q: number } =>
          !!x &&
          typeof (x as { p?: unknown }).p === "string" &&
          Number.isInteger((x as { q?: unknown }).q) &&
          (x as { q: number }).q > 0,
      )
      .slice(0, MAX_LINES)
      .map((x) => ({ productId: x.p, quantity: x.q }));
  } catch {
    return [];
  }
}

export async function guestCartCount(): Promise<number> {
  const items = await readGuestCart();
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/** Écriture - UNIQUEMENT dans une server action ou un route handler. */
export async function writeGuestCart(items: GuestCartItem[]): Promise<void> {
  const store = await cookies();
  if (items.length === 0) {
    store.set(GUEST_CART_COOKIE, "", { path: "/", maxAge: 0 });
    return;
  }
  const payload = JSON.stringify(
    items.slice(0, MAX_LINES).map((i) => ({ p: i.productId, q: i.quantity })),
  );
  store.set(GUEST_CART_COOKIE, payload, {
    path: "/",
    maxAge: MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearGuestCart(): Promise<void> {
  (await cookies()).set(GUEST_CART_COOKIE, "", { path: "/", maxAge: 0 });
}

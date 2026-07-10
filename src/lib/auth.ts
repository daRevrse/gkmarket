import "server-only";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { courierProfiles, sellerProfiles, users } from "@/db/schema";
import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE = "__session";

export type CurrentUser = typeof users.$inferSelect & {
  sellerProfile: typeof sellerProfiles.$inferSelect | null;
  courierProfile: typeof courierProfiles.$inferSelect | null;
};

export type SellerUser = CurrentUser & {
  sellerProfile: NonNullable<CurrentUser["sellerProfile"]>;
};
export type CourierUser = CurrentUser & {
  courierProfile: NonNullable<CurrentUser["courierProfile"]>;
};

/**
 * Garde de page pour l'espace vendeur : redirige si l'utilisateur n'est pas un
 * vendeur approuvé. À appeler dans chaque page (le layout et la page rendent en
 * parallèle : sans garde ici, un accès non authentifié plante la page).
 */
export async function requireApprovedSeller(): Promise<SellerUser> {
  const user = await getCurrentUser();
  if (user?.sellerProfile?.status !== "approved") {
    redirect("/compte/devenir-vendeur");
  }
  return user as SellerUser;
}

/** Garde de page pour l'espace livreur (cf. requireApprovedSeller). */
export async function requireApprovedCourier(): Promise<CourierUser> {
  const user = await getCurrentUser();
  if (user?.courierProfile?.status !== "approved") {
    redirect("/compte/devenir-livreur");
  }
  return user as CourierUser;
}

/**
 * Résout l'utilisateur courant depuis le cookie de session.
 * Retourne null si non connecté, session invalide ou compte suspendu/banni.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(session);
    const rows = await db
      .select()
      .from(users)
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
      .leftJoin(courierProfiles, eq(courierProfiles.userId, users.id))
      .where(eq(users.firebaseUid, decoded.uid))
      .limit(1);

    const row = rows[0];
    if (!row || row.users.status !== "active") return null;

    return {
      ...row.users,
      sellerProfile: row.seller_profiles,
      courierProfile: row.courier_profiles,
    };
  } catch {
    return null;
  }
}

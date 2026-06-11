"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  addresses,
  courierProfiles,
  sellerProfiles,
  userArchives,
  users,
} from "@/db/schema";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";

/**
 * Suppression de compte avec archivage : l'identité est copiée dans
 * `user_archives` (trace légale/litiges), la ligne `users` est anonymisée
 * mais conservée (intégrité des futures commandes), et le compte Firebase
 * est supprimé (email/téléphone libérés pour une future réinscription).
 */
export async function deleteMyAccount(): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  try {
    await db.transaction(async (tx) => {
      await tx.insert(userArchives).values({
        userId: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        hadSellerProfile: !!user.sellerProfile,
        hadCourierProfile: !!user.courierProfile,
      });

      // Purge des données personnelles rattachées
      await tx.delete(addresses).where(eq(addresses.userId, user.id));
      await tx
        .delete(sellerProfiles)
        .where(eq(sellerProfiles.userId, user.id));
      await tx
        .delete(courierProfiles)
        .where(eq(courierProfiles.userId, user.id));

      await tx
        .update(users)
        .set({
          email: null,
          phone: null,
          fullName: "Compte supprimé",
          status: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    });

    // Libère l'email/le numéro côté Firebase. En cas d'échec, le compte
    // reste verrouillé (status = deleted), donc pas bloquant.
    try {
      await adminAuth.deleteUser(user.firebaseUid);
    } catch (err) {
      console.error("Suppression Firebase échouée:", err);
    }

    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
    return {};
  } catch (err) {
    console.error("Suppression de compte échouée:", err);
    return { error: "La suppression a échoué. Réessayez." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export type ProfileInput = {
  fullName: string;
  shop?: {
    shopName: string;
    shopDescription: string;
    city: string;
    district: string;
    contactPhone: string;
    /** URL du logo uploadé (undefined = ne pas modifier). */
    logoUrl?: string | null;
  };
};

/** Met à jour le profil utilisateur (+ la boutique si l'utilisateur en a une). */
export async function updateProfile(
  input: ProfileInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Session expirée. Reconnectez-vous." };

  const fullName = input.fullName.trim();
  if (!fullName) return { error: "Votre nom est requis." };

  await db
    .update(users)
    .set({ fullName, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  if (input.shop && user.sellerProfile) {
    const s = input.shop;
    if (!s.shopName.trim()) {
      return { error: "Le nom de la boutique est requis." };
    }
    await db
      .update(sellerProfiles)
      .set({
        shopName: s.shopName.trim(),
        shopDescription: s.shopDescription.trim() || null,
        city: s.city.trim() || "Lomé",
        district: s.district.trim() || null,
        contactPhone: s.contactPhone.trim() || null,
        ...(s.logoUrl !== undefined ? { logoUrl: s.logoUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.userId, user.id));
  }

  revalidatePath("/compte/profil");
  revalidatePath("/compte");
  return {};
}

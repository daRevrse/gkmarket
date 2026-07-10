"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeTogoPhone } from "@/lib/phone";

export type ProfileInput = {
  fullName: string;
  shop?: {
    shopName: string;
    shopDescription: string;
    city: string;
    district: string;
    contactPhone: string;
    sellingConditions: string;
    payoutMethod: "" | "mobile_money" | "bank";
    mobileMoneyOperator: "" | "flooz" | "tmoney";
    mobileMoneyNumber: string;
    bankName: string;
    bankAccountName: string;
    bankIban: string;
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

    // Coordonnées de versement : Mobile Money ou virement bancaire.
    const payoutMethod =
      s.payoutMethod === "mobile_money" || s.payoutMethod === "bank"
        ? s.payoutMethod
        : null;
    if (payoutMethod === "mobile_money") {
      if (!s.mobileMoneyNumber.trim()) {
        return { error: "Renseignez le numéro Mobile Money de versement." };
      }
      const num = normalizeTogoPhone(s.mobileMoneyNumber);
      if (!num) {
        return { error: "Numéro Mobile Money invalide (format Togo)." };
      }
    }
    if (payoutMethod === "bank" && !s.bankIban.trim()) {
      return { error: "Renseignez le RIB/IBAN de versement." };
    }
    const mobileMoneyNumber =
      payoutMethod === "mobile_money"
        ? normalizeTogoPhone(s.mobileMoneyNumber)
        : null;

    await db
      .update(sellerProfiles)
      .set({
        shopName: s.shopName.trim(),
        shopDescription: s.shopDescription.trim() || null,
        city: s.city.trim() || "Lomé",
        district: s.district.trim() || null,
        contactPhone: s.contactPhone.trim() || null,
        sellingConditions: s.sellingConditions.trim() || null,
        payoutMethod,
        mobileMoneyOperator:
          payoutMethod === "mobile_money" && s.mobileMoneyOperator
            ? s.mobileMoneyOperator
            : null,
        mobileMoneyNumber,
        bankName: payoutMethod === "bank" ? s.bankName.trim() || null : null,
        bankAccountName:
          payoutMethod === "bank" ? s.bankAccountName.trim() || null : null,
        bankIban: payoutMethod === "bank" ? s.bankIban.trim() || null : null,
        ...(s.logoUrl !== undefined ? { logoUrl: s.logoUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sellerProfiles.userId, user.id));
  }

  revalidatePath("/compte/profil");
  revalidatePath("/compte");
  return {};
}

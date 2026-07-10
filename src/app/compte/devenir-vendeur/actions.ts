"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeTogoPhone } from "@/lib/phone";

export type SellerApplicationInput = {
  shopName: string;
  shopDescription?: string;
  city: string;
  district?: string;
  contactPhone?: string;
  rccm?: string;
  idDocumentPath: string;
  rccmDocumentPath?: string;
  addressDocumentPath?: string;
  termsAccepted: boolean;
};

export async function submitSellerApplication(
  input: SellerApplicationInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  if (!input.shopName?.trim()) {
    return { error: "Le nom de la boutique est requis." };
  }
  if (!input.city?.trim()) {
    return { error: "La ville est requise." };
  }
  if (!input.termsAccepted) {
    return { error: "Vous devez accepter les conditions vendeur." };
  }

  // Les documents doivent appartenir au dossier KYC de l'utilisateur :
  // empêche de référencer le document d'un autre compte.
  const prefix = `kyc/${user.firebaseUid}/`;
  if (!input.idDocumentPath?.startsWith(prefix)) {
    return { error: "La pièce d'identité est requise." };
  }
  if (input.rccmDocumentPath && !input.rccmDocumentPath.startsWith(prefix)) {
    return { error: "Document RCCM invalide." };
  }
  if (
    input.addressDocumentPath &&
    !input.addressDocumentPath.startsWith(prefix)
  ) {
    return { error: "Justificatif d'adresse invalide." };
  }

  let contactPhone: string | null = null;
  if (input.contactPhone?.trim()) {
    contactPhone = normalizeTogoPhone(input.contactPhone);
    if (!contactPhone) {
      return { error: "Téléphone de la boutique invalide (format Togo)." };
    }
  }

  const values = {
    shopName: input.shopName.trim(),
    shopDescription: input.shopDescription?.trim() || null,
    city: input.city.trim(),
    district: input.district?.trim() || null,
    contactPhone,
    rccm: input.rccm?.trim() || null,
    idDocumentPath: input.idDocumentPath,
    rccmDocumentPath: input.rccmDocumentPath || null,
    addressDocumentPath: input.addressDocumentPath || null,
    termsAcceptedAt: new Date(),
    status: "pending" as const,
    rejectionReason: null,
    reviewedAt: null,
    updatedAt: new Date(),
  };

  if (user.sellerProfile) {
    // Une demande refusée peut être soumise à nouveau ; une demande en cours
    // ou approuvée ne doit pas être écrasée.
    if (user.sellerProfile.status !== "rejected") {
      return { error: "Vous avez déjà une demande en cours ou approuvée." };
    }
    await db
      .update(sellerProfiles)
      .set(values)
      .where(eq(sellerProfiles.userId, user.id));
  } else {
    await db.insert(sellerProfiles).values({ userId: user.id, ...values });
  }

  revalidatePath("/compte");
  revalidatePath("/compte/devenir-vendeur");
  return {};
}

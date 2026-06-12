"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, vehicleTypeEnum } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeTogoPhone } from "@/lib/phone";

export type CourierApplicationInput = {
  vehicleType: string;
  city: string;
  district?: string;
  serviceArea?: string;
  contactPhone?: string;
  idDocumentPath: string;
};

export async function submitCourierApplication(
  input: CourierApplicationInput,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const vehicleType = vehicleTypeEnum.enumValues.find(
    (value) => value === input.vehicleType,
  );
  if (!vehicleType) {
    return { error: "Choisissez votre moyen de transport." };
  }
  if (!input.city?.trim()) {
    return { error: "La ville est requise." };
  }

  // Le document doit appartenir au dossier KYC de l'utilisateur :
  // empêche de référencer le document d'un autre compte.
  const prefix = `kyc/${user.firebaseUid}/`;
  if (!input.idDocumentPath?.startsWith(prefix)) {
    return { error: "La pièce d'identité est requise." };
  }

  let contactPhone: string | null = null;
  if (input.contactPhone?.trim()) {
    contactPhone = normalizeTogoPhone(input.contactPhone);
    if (!contactPhone) {
      return { error: "Téléphone de contact invalide (format Togo)." };
    }
  }

  const values = {
    vehicleType,
    city: input.city.trim(),
    district: input.district?.trim() || null,
    serviceArea: input.serviceArea?.trim() || null,
    contactPhone,
    idDocumentPath: input.idDocumentPath,
    status: "pending" as const,
    rejectionReason: null,
    reviewedAt: null,
    updatedAt: new Date(),
  };

  if (user.courierProfile) {
    // Une demande refusée peut être soumise à nouveau ; une demande en cours
    // ou approuvée ne doit pas être écrasée.
    if (user.courierProfile.status !== "rejected") {
      return { error: "Vous avez déjà une demande en cours ou approuvée." };
    }
    await db
      .update(courierProfiles)
      .set(values)
      .where(eq(courierProfiles.userId, user.id));
  } else {
    await db.insert(courierProfiles).values({ userId: user.id, ...values });
  }

  revalidatePath("/compte");
  revalidatePath("/compte/devenir-livreur");
  return {};
}

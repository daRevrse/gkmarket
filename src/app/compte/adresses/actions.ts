"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { normalizeTogoPhone } from "@/lib/phone";

export type AddressInput = {
  label?: string;
  recipientName: string;
  recipientPhone: string;
  city: string;
  district?: string;
  details?: string;
};

type ActionResult = { error?: string };

function validate(input: AddressInput): { error?: string; phone?: string } {
  if (!input.recipientName?.trim()) {
    return { error: "Le nom du destinataire est requis." };
  }
  const phone = normalizeTogoPhone(input.recipientPhone ?? "");
  if (!phone) {
    return { error: "Numéro du destinataire invalide (format Togo attendu)." };
  }
  if (!input.city?.trim()) {
    return { error: "La ville est requise." };
  }
  return { phone };
}

export async function createAddress(input: AddressInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { error, phone } = validate(input);
  if (error || !phone) return { error };

  const existing = await db.$count(addresses, eq(addresses.userId, user.id));
  await db.insert(addresses).values({
    userId: user.id,
    label: input.label?.trim() || null,
    recipientName: input.recipientName.trim(),
    recipientPhone: phone,
    city: input.city.trim(),
    district: input.district?.trim() || null,
    details: input.details?.trim() || null,
    // La première adresse devient l'adresse par défaut.
    isDefault: existing === 0,
  });

  revalidatePath("/compte/adresses");
  return {};
}

export async function updateAddress(
  id: string,
  input: AddressInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  const { error, phone } = validate(input);
  if (error || !phone) return { error };

  await db
    .update(addresses)
    .set({
      label: input.label?.trim() || null,
      recipientName: input.recipientName.trim(),
      recipientPhone: phone,
      city: input.city.trim(),
      district: input.district?.trim() || null,
      details: input.details?.trim() || null,
      updatedAt: new Date(),
    })
    .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));

  revalidatePath("/compte/adresses");
  return {};
}

export async function deleteAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)))
      .returning({ isDefault: addresses.isDefault });

    // Si l'adresse par défaut a été supprimée, on promeut la plus récente.
    if (deleted?.isDefault) {
      const [next] = await tx
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.userId, user.id))
        .orderBy(desc(addresses.createdAt))
        .limit(1);
      if (next) {
        await tx
          .update(addresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(addresses.id, next.id));
      }
    }
  });

  revalidatePath("/compte/adresses");
  return {};
}

export async function setDefaultAddress(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  await db.transaction(async (tx) => {
    await tx
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.userId, user.id));
    await tx
      .update(addresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(addresses.id, id), eq(addresses.userId, user.id)));
  });

  revalidatePath("/compte/adresses");
  return {};
}

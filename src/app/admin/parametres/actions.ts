"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";
import { SETTING_KEYS } from "@/lib/settings";

/**
 * Paramètres généraux de la plateforme (MVP n°267, 270, 271) : commission et
 * frais de livraison, appliqués immédiatement au panier/checkout et aux
 * prochains déblocages de fonds.
 */
export async function updatePlatformSettings(input: {
  commissionRatePct: number;
  deliveryFeeFcfa: number;
  serviceFeePct: number;
  mobileMoneyFeePct: number;
}): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  const pct = Number(input.commissionRatePct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
    return { error: "Le taux de commission doit être entre 0 et 50 %." };
  }
  const fee = Math.round(Number(input.deliveryFeeFcfa));
  if (!Number.isFinite(fee) || fee < 0 || fee > 100000) {
    return { error: "Les frais de livraison doivent être entre 0 et 100 000 FCFA." };
  }

  const servicePct = Number(input.serviceFeePct);
  if (!Number.isFinite(servicePct) || servicePct < 0 || servicePct > 20) {
    return { error: "Les frais de service doivent être entre 0 et 20 %." };
  }
  const mobilePct = Number(input.mobileMoneyFeePct);
  if (!Number.isFinite(mobilePct) || mobilePct < 0 || mobilePct > 10) {
    return { error: "Les frais Mobile Money doivent être entre 0 et 10 %." };
  }

  const entries: [string, string][] = [
    [SETTING_KEYS.commissionRatePct, String(pct)],
    [SETTING_KEYS.deliveryFeeFcfa, String(fee)],
    [SETTING_KEYS.serviceFeePct, String(servicePct)],
    [SETTING_KEYS.mobileMoneyFeePct, String(mobilePct)],
  ];
  for (const [key, value] of entries) {
    await db
      .insert(platformSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: sql`now()` },
      });
  }

  await logAdmin(admin.id, "Paramètres plateforme modifiés", {
    targetType: "parametres",
    details: `commission ${pct} % · livraison ${fee} FCFA · frais de service ${servicePct} % · Mobile Money ${mobilePct} %`,
  });

  revalidatePath("/admin/parametres");
  revalidatePath("/panier");
  revalidatePath("/commande");
  revalidatePath("/compte/wallet");
  return {};
}

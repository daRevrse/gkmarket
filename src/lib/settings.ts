import "server-only";

import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import {
  DELIVERY_FEE_PER_SELLER_FCFA,
  PLATFORM_COMMISSION_RATE,
} from "@/lib/pricing";

// Paramètres éditables par l'admin (MVP n°267, 270, 271), avec repli sur les
// constantes historiques si la table est vide ou la valeur invalide.
export type PlatformSettings = {
  /** Taux de commission plateforme, en pourcentage (ex. 5). */
  commissionRatePct: number;
  /** Frais de livraison forfaitaires par vendeur, en FCFA. */
  deliveryFeeFcfa: number;
};

export const SETTING_KEYS = {
  commissionRatePct: "commission_rate_pct",
  deliveryFeeFcfa: "delivery_fee_fcfa",
} as const;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const rows = await db.select().from(platformSettings);
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const pct = Number(map.get(SETTING_KEYS.commissionRatePct));
  const fee = Number(map.get(SETTING_KEYS.deliveryFeeFcfa));

  return {
    commissionRatePct:
      Number.isFinite(pct) && pct >= 0 && pct <= 50
        ? pct
        : PLATFORM_COMMISSION_RATE * 100,
    deliveryFeeFcfa:
      Number.isFinite(fee) && fee >= 0 && fee <= 100000
        ? Math.round(fee)
        : DELIVERY_FEE_PER_SELLER_FCFA,
  };
}

/** Commission en FCFA à partir du taux paramétré (arrondi au franc). */
export function commissionFromRate(
  subtotalFcfa: number,
  ratePct: number,
): number {
  return Math.round((subtotalFcfa * ratePct) / 100);
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { feeFromPct } from "@/lib/orders";
import { normalizeTogoPhone } from "@/lib/phone";
import { getPlatformSettings } from "@/lib/settings";
import { applyWalletMovement, getOrCreateWallet } from "@/lib/wallet";

const MIN_AMOUNT = 100;
const MAX_AMOUNT = 5_000_000;

// En local, l'agrégateur de paiement est simulé : la recharge crédite
// immédiatement. En production : intégration CinetPay/Semoa (Flooz, Tmoney…).
// DEMO_MODE=1 force aussi la simulation sur un déploiement de démonstration
// (staging Vercel sans émulateur), pour rendre le cycle Escrow démontrable
// sans agrégateur réel.
const SIMULATED =
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.DEMO_MODE === "1";

export async function rechargeWallet(
  amountFcfa: number,
  operator: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  if (
    !Number.isInteger(amountFcfa) ||
    amountFcfa < MIN_AMOUNT ||
    amountFcfa > MAX_AMOUNT
  ) {
    return {
      error: `Montant invalide (entre ${MIN_AMOUNT} et ${MAX_AMOUNT.toLocaleString("fr-FR")} FCFA).`,
    };
  }
  const operators = ["Flooz", "Tmoney", "MTN MoMo", "Moov Money"];
  if (!operators.includes(operator)) {
    return { error: "Choisissez un opérateur." };
  }
  if (!SIMULATED) {
    return { error: "Paiement réel non configuré (agrégateur à venir)." };
  }

  // Frais de l'agrégateur à la charge de l'acheteur : débités en plus sur
  // son Mobile Money, le wallet est crédité du montant demandé.
  const { mobileMoneyFeePct } = await getPlatformSettings();
  const fee = feeFromPct(amountFcfa, mobileMoneyFeePct);

  const wallet = await getOrCreateWallet(user.id);
  await db.transaction(async (tx) => {
    await applyWalletMovement(tx, wallet.id, {
      type: "recharge",
      amountFcfa,
      description: `Recharge ${operator} (simulée)${fee > 0 ? ` - frais Mobile Money ${formatFcfa(fee)} à votre charge` : ""}`,
    });
  });

  revalidatePath("/compte/wallet");
  return {};
}

export async function withdrawFromWallet(
  amountFcfa: number,
  phone: string,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Vous devez être connecté." };

  if (!Number.isInteger(amountFcfa) || amountFcfa < MIN_AMOUNT) {
    return { error: `Montant minimum : ${MIN_AMOUNT} FCFA.` };
  }
  const normalized = normalizeTogoPhone(phone);
  if (!normalized) {
    return { error: "Numéro Mobile Money invalide (format Togo)." };
  }
  if (!SIMULATED) {
    return { error: "Retrait réel non configuré (agrégateur à venir)." };
  }

  const wallet = await getOrCreateWallet(user.id);
  let ok = false;
  // Si le débit échoue (solde insuffisant), aucun mouvement n'a été écrit :
  // la transaction se termine sans effet.
  await db.transaction(async (tx) => {
    ok = await applyWalletMovement(tx, wallet.id, {
      type: "withdrawal",
      amountFcfa: -amountFcfa,
      description: `Retrait vers ${normalized} (simulé)`,
    });
  });
  if (!ok) return { error: "Solde insuffisant." };

  revalidatePath("/compte/wallet");
  return {};
}

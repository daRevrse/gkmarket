"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { autoReleaseOverdueEscrows } from "@/lib/escrow";

/** Exécution manuelle du déblocage automatique (MVP n°119). */
export async function runEscrowAutoRelease(): Promise<{
  error?: string;
  released?: number;
}> {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return { error: "Réservé aux administrateurs." };

  const released = await autoReleaseOverdueEscrows();
  revalidatePath("/admin/financier");
  revalidatePath("/admin");
  return { released };
}

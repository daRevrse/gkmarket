"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";

/**
 * Pénalités de compte (MVP n°209-211, 236-237) : suspension réversible,
 * bannissement, réactivation. La session du compte visé devient inopérante
 * immédiatement (getCurrentUser refuse tout statut non actif).
 */
export async function setUserStatus(
  userId: string,
  status: "active" | "suspended" | "banned",
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };
  if (!["active", "suspended", "banned"].includes(status)) {
    return { error: "Statut invalide." };
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) return { error: "Utilisateur introuvable." };
  if (target.id === admin.id) {
    return { error: "Vous ne pouvez pas modifier votre propre compte." };
  }
  if (target.isAdmin) {
    return { error: "Le compte d'un administrateur ne peut pas être modifié ici." };
  }
  if (target.status === "deleted") {
    return { error: "Ce compte a été supprimé." };
  }

  await db
    .update(users)
    .set({ status, updatedAt: new Date() })
    .where(eq(users.id, userId));

  const actionLabel: Record<typeof status, string> = {
    active: "Compte réactivé",
    suspended: "Compte suspendu",
    banned: "Compte banni",
  };
  await logAdmin(admin.id, actionLabel[status], {
    targetType: "utilisateur",
    targetId: userId,
    details: target.fullName ?? target.email ?? target.phone ?? undefined,
  });

  revalidatePath("/admin/utilisateurs");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function approveSeller(
  profileId: string,
): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "Accès refusé." };

  const [profile] = await db
    .update(sellerProfiles)
    .set({
      status: "approved",
      rejectionReason: null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sellerProfiles.id, profileId))
    .returning({ userId: sellerProfiles.userId, shopName: sellerProfiles.shopName });

  // MVP n°310 — validation du compte vendeur.
  if (profile) {
    await notify(profile.userId, {
      type: "seller_approved",
      title: `Boutique « ${profile.shopName} » approuvée 🎉`,
      body: "Vous pouvez publier vos produits et recevoir des commandes.",
      link: "/vendeur/produits",
      email: true,
    });
  }

  revalidatePath("/admin/vendeurs");
  return {};
}

export async function rejectSeller(
  profileId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "Accès refusé." };
  if (!reason?.trim()) {
    return { error: "Indiquez le motif du refus (visible par le vendeur)." };
  }

  const [profile] = await db
    .update(sellerProfiles)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sellerProfiles.id, profileId))
    .returning({ userId: sellerProfiles.userId });

  if (profile) {
    await notify(profile.userId, {
      type: "seller_rejected",
      title: "Demande vendeur refusée",
      body: `Motif : ${reason.trim()}. Vous pouvez corriger et soumettre à nouveau.`,
      link: "/compte/devenir-vendeur",
      email: true,
    });
  }

  revalidatePath("/admin/vendeurs");
  return {};
}

/**
 * Suspension de boutique (MVP n°210, 242) : les produits disparaissent du
 * catalogue (les requêtes publiques exigent une boutique approuvée) et
 * l'espace vendeur devient inaccessible. Réversible.
 */
export async function setSellerSuspension(
  profileId: string,
  suspended: boolean,
): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "Accès refusé." };

  const updated = await db
    .update(sellerProfiles)
    .set({
      status: suspended ? "suspended" : "approved",
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sellerProfiles.id, profileId),
        eq(sellerProfiles.status, suspended ? "approved" : "suspended"),
      ),
    )
    .returning({ id: sellerProfiles.id });
  if (updated.length === 0) {
    return { error: "Transition impossible (statut déjà modifié ?)." };
  }

  revalidatePath("/admin/vendeurs");
  revalidatePath("/produits");
  revalidatePath("/");
  return {};
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { normalizeTogoPhone } from "@/lib/phone";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function approveSeller(
  profileId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

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

  // MVP n°310 - validation du compte vendeur.
  if (profile) {
    await notify(profile.userId, {
      type: "seller_approved",
      title: `Boutique « ${profile.shopName} » approuvée 🎉`,
      body: "Vous pouvez publier vos produits et recevoir des commandes.",
      link: "/vendeur/produits",
      email: true,
    });
    await logAdmin(admin.id, "Boutique approuvée", {
      targetType: "vendeur",
      targetId: profileId,
      details: profile.shopName,
    });
  }

  revalidatePath("/admin/vendeurs");
  return {};
}

export async function rejectSeller(
  profileId: string,
  reason: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };
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
    await logAdmin(admin.id, "Demande vendeur refusée", {
      targetType: "vendeur",
      targetId: profileId,
      details: reason.trim(),
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
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

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

  await logAdmin(
    admin.id,
    suspended ? "Boutique suspendue" : "Boutique réactivée",
    { targetType: "vendeur", targetId: profileId },
  );

  revalidatePath("/admin/vendeurs");
  revalidatePath("/produits");
  revalidatePath("/");
  return {};
}

/**
 * Modification des informations de la boutique par l'admin (MVP n°241) :
 * correction de coordonnées ou de contenu inapproprié, journalisée.
 */
export async function updateSellerInfo(
  profileId: string,
  input: {
    shopName: string;
    shopDescription: string;
    city: string;
    district: string;
    contactPhone: string;
  },
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const shopName = input.shopName.trim();
  if (!shopName) return { error: "Le nom de la boutique est requis." };

  let contactPhone: string | null = null;
  if (input.contactPhone.trim()) {
    contactPhone = normalizeTogoPhone(input.contactPhone);
    if (!contactPhone) {
      return { error: "Téléphone de la boutique invalide (format Togo)." };
    }
  }

  const updated = await db
    .update(sellerProfiles)
    .set({
      shopName,
      shopDescription: input.shopDescription.trim() || null,
      city: input.city.trim() || "Lomé",
      district: input.district.trim() || null,
      contactPhone,
      updatedAt: new Date(),
    })
    .where(eq(sellerProfiles.id, profileId))
    .returning({ id: sellerProfiles.id });
  if (updated.length === 0) return { error: "Boutique introuvable." };

  await logAdmin(admin.id, "Informations boutique modifiées", {
    targetType: "vendeur",
    targetId: profileId,
    details: shopName,
  });

  revalidatePath("/admin/vendeurs");
  revalidatePath(`/boutique/${profileId}`);
  return {};
}

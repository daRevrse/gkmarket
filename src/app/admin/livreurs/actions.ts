"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function approveCourier(
  profileId: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };

  const [profile] = await db
    .update(courierProfiles)
    .set({
      status: "approved",
      rejectionReason: null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courierProfiles.id, profileId))
    .returning({ userId: courierProfiles.userId });

  if (profile) {
    await notify(profile.userId, {
      type: "courier_approved",
      title: "Profil livreur approuvé 🎉",
      body: "Les vendeurs peuvent désormais vous proposer des courses.",
      link: "/livreur/courses",
      email: true,
    });
    await logAdmin(admin.id, "Livreur approuvé", {
      targetType: "livreur",
      targetId: profileId,
    });
  }

  revalidatePath("/admin/livreurs");
  return {};
}

export async function rejectCourier(
  profileId: string,
  reason: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!admin) return { error: "Accès refusé." };
  if (!reason?.trim()) {
    return { error: "Indiquez le motif du refus (visible par le livreur)." };
  }

  const [profile] = await db
    .update(courierProfiles)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courierProfiles.id, profileId))
    .returning({ userId: courierProfiles.userId });

  if (profile) {
    await notify(profile.userId, {
      type: "courier_rejected",
      title: "Demande livreur refusée",
      body: `Motif : ${reason.trim()}. Vous pouvez corriger et soumettre à nouveau.`,
      link: "/compte/devenir-livreur",
      email: true,
    });
    await logAdmin(admin.id, "Demande livreur refusée", {
      targetType: "livreur",
      targetId: profileId,
      details: reason.trim(),
    });
  }

  revalidatePath("/admin/livreurs");
  return {};
}

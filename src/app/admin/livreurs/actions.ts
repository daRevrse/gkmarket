"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.isAdmin ? user : null;
}

export async function approveCourier(
  profileId: string,
): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "Accès refusé." };

  await db
    .update(courierProfiles)
    .set({
      status: "approved",
      rejectionReason: null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courierProfiles.id, profileId));

  revalidatePath("/admin/livreurs");
  return {};
}

export async function rejectCourier(
  profileId: string,
  reason: string,
): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: "Accès refusé." };
  if (!reason?.trim()) {
    return { error: "Indiquez le motif du refus (visible par le livreur)." };
  }

  await db
    .update(courierProfiles)
    .set({
      status: "rejected",
      rejectionReason: reason.trim(),
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(courierProfiles.id, profileId));

  revalidatePath("/admin/livreurs");
  return {};
}

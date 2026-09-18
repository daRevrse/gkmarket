"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contactViolations, users } from "@/db/schema";
import { logAdmin } from "@/lib/admin-log";
import { getCurrentUser } from "@/lib/auth";

async function userName(userId: string) {
  const [user] = await db
    .select({ fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.fullName ?? undefined;
}

/** Marque les tentatives bloquées d'un compte comme examinées. */
export async function markViolationsReviewed(
  userId: string,
): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  await db
    .update(contactViolations)
    .set({ reviewedAt: new Date() })
    .where(
      and(
        eq(contactViolations.userId, userId),
        isNull(contactViolations.reviewedAt),
      ),
    );
  await logAdmin(admin.id, "Tentatives de contournement examinées", {
    targetType: "utilisateur",
    targetId: userId,
    details: await userName(userId),
  });
  revalidatePath("/admin/surveillance", "layout");
  return {};
}

/**
 * Lève la surveillance : les tentatives en cours sont classées. Une nouvelle
 * tentative replacera le compte sous surveillance.
 */
export async function liftWatch(userId: string): Promise<{ error?: string }> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { error: "Réservé aux administrateurs." };

  await db.transaction(async (tx) => {
    await tx.update(users).set({ watchedAt: null }).where(eq(users.id, userId));
    await tx
      .update(contactViolations)
      .set({ reviewedAt: new Date() })
      .where(
        and(
          eq(contactViolations.userId, userId),
          isNull(contactViolations.reviewedAt),
        ),
      );
  });
  await logAdmin(admin.id, "Surveillance levée", {
    targetType: "utilisateur",
    targetId: userId,
    details: await userName(userId),
  });
  revalidatePath("/admin/surveillance", "layout");
  return {};
}

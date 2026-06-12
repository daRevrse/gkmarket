import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export type NotificationInput = {
  type: string;
  title: string;
  body?: string;
  /** Chemin interne vers la ressource concernée (ex. /compte/commandes/xxx). */
  link?: string;
  /** Doubler la notification d'un email transactionnel. */
  email?: boolean;
};

/**
 * Notification in-app (+ email optionnel) pour un utilisateur.
 * À appeler APRÈS la transaction métier — ne lève jamais : la communication
 * ne doit pas faire échouer l'action qui la déclenche.
 */
export async function notify(
  userId: string,
  input: NotificationInput,
): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });

    if (input.email) {
      const [user] = await db
        .select({ email: users.email, status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (user?.email && user.status === "active") {
        await sendEmail({
          toEmail: user.email,
          subject: `GK Market — ${input.title}`,
          bodyText: [
            input.title,
            "",
            input.body ?? "",
            input.link ? `\nDétails : https://gkmarket.tg${input.link}` : "",
            "\n— L'équipe GK Market",
          ].join("\n"),
        });
      }
    }
  } catch {
    // Jamais bloquant.
  }
}

/** Même notification pour plusieurs destinataires (ex. tous les admins). */
export async function notifyMany(
  userIds: string[],
  input: NotificationInput,
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify(userId, input)));
}

/** Ids des administrateurs actifs (litiges, alertes plateforme). */
export async function adminUserIds(): Promise<string[]> {
  try {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.isAdmin, true), eq(users.status, "active")));
    return rows.map((row) => row.id);
  } catch {
    return [];
  }
}

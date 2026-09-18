import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { contactViolations, users } from "@/db/schema";
import {
  CONTACT_REASON_LABELS,
  detectContactInfo,
  type ContactReason,
} from "@/lib/contact-guard";
import { adminUserIds, notify, notifyMany } from "@/lib/notify";

type GuardContext = {
  context: "message" | "product" | "shop" | "profile";
  conversationId?: string;
};

/**
 * Anti-contournement (cf. docs/CHANGEMENTS.md §5) : si le texte contient des
 * coordonnées, la tentative est journalisée, l'auteur est placé sous
 * surveillance (admins prévenus la première fois) et les motifs sont
 * retournés - l'appelant bloque alors l'enregistrement.
 */
export async function blockContactInfo(
  userId: string,
  text: string,
  { context, conversationId }: GuardContext,
): Promise<ContactReason[] | null> {
  const reasons = detectContactInfo(text);
  if (reasons.length === 0) return null;

  try {
    await db.insert(contactViolations).values({
      userId,
      context,
      conversationId: conversationId ?? null,
      excerpt: text.slice(0, 2000),
      reasons,
    });

    // Première mise sous surveillance : avertissement + alerte admins.
    const placed = await db
      .update(users)
      .set({ watchedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.watchedAt)))
      .returning({ fullName: users.fullName });
    if (placed.length > 0) {
      await notify(userId, {
        type: "contact_warning",
        title: "Avertissement : partage de coordonnées bloqué",
        body: "Les échanges et paiements doivent rester sur Deal Lomé. Les tentatives répétées peuvent entraîner la suspension du compte.",
        link: "/cgu",
      });
      await notifyMany(await adminUserIds(), {
        type: "user_watched",
        title: "Utilisateur placé sous surveillance",
        body: `${placed[0].fullName ?? "Un utilisateur"} a tenté de partager des coordonnées (${reasons.map((r) => CONTACT_REASON_LABELS[r]).join(", ")}).`,
        link: `/admin/surveillance/${userId}`,
      });
    }
  } catch {
    // La journalisation ne doit pas empêcher le blocage lui-même.
  }
  return reasons;
}

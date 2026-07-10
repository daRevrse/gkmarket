import "server-only";

import { db } from "@/db";
import { adminLogs } from "@/db/schema";

/**
 * Journalise une action admin (MVP n°296). Best-effort : un échec d'écriture
 * du journal ne doit jamais bloquer l'action elle-même.
 */
export async function logAdmin(
  adminId: string,
  action: string,
  opts?: { targetType?: string; targetId?: string; details?: string },
): Promise<void> {
  try {
    await db.insert(adminLogs).values({
      adminId,
      action,
      targetType: opts?.targetType ?? null,
      targetId: opts?.targetId ?? null,
      details: opts?.details ?? null,
    });
  } catch {
    // Journal indisponible : on n'interrompt pas l'action.
  }
}

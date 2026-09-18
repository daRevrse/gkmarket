"use server";

import { logSearch } from "@/lib/search";

/** Journal anonyme des recherches (tendances, demandes non servies). */
export async function recordSearch(query: string): Promise<void> {
  if (typeof query !== "string" || !query.trim() || query.length > 200) return;
  await logSearch(query);
}

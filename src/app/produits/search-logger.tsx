"use client";

import { useEffect, useRef } from "react";
import { recordSearch } from "./actions";

/**
 * Enregistre une recherche une seule fois à l'arrivée sur les résultats :
 * les re-rendus de la page (cœur « Ma liste », rafraîchissements) et les
 * robots sans JavaScript ne faussent pas les statistiques.
 */
export function SearchLogger({ query }: { query: string }) {
  const logged = useRef<string | null>(null);
  useEffect(() => {
    if (logged.current === query) return;
    logged.current = query;
    void recordSearch(query);
  }, [query]);
  return null;
}

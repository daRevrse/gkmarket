/**
 * Valide une destination `?next=` : uniquement un chemin interne absolu
 * (jamais une URL externe ou protocol-relative `//evil.com`). Sinon repli.
 */
export function safeInternalPath(
  next: string | null | undefined,
  fallback = "/compte",
): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

/** Destination post-connexion lue depuis l'URL courante (côté client). */
export function nextFromLocation(fallback = "/compte"): string {
  if (typeof window === "undefined") return fallback;
  return safeInternalPath(
    new URLSearchParams(window.location.search).get("next"),
    fallback,
  );
}

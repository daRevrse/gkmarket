"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline";
import { HeartIcon as HeartSolid } from "@heroicons/react/24/solid";
import { toggleWishlist } from "@/app/compte/liste/actions";
import { cn } from "@/lib/utils";

type WishlistContext = {
  /** null tant que la liste n'est pas chargée (ou visiteur non connecté). */
  ids: Set<string> | null;
  toggle: (productId: string) => Promise<{ error?: string }>;
};

const Context = createContext<WishlistContext | null>(null);

/**
 * « Ma liste » côté navigateur : identifiants chargés une fois par page
 * (/api/liste) pour les cœurs des cartes produit, mis à jour de façon
 * optimiste au clic.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ids, setIds] = useState<Set<string> | null>(null);

  // Rechargé à chaque navigation : suit la connexion/déconnexion.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/liste", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { ids: null }))
      .then((data: { ids: string[] | null }) => {
        if (!cancelled) setIds(data.ids ? new Set(data.ids) : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function toggle(productId: string) {
    const before = ids;
    if (before) {
      const next = new Set(before);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      setIds(next);
    }
    const result = await toggleWishlist(productId);
    if (result.loginRequired) {
      const here = window.location.pathname + window.location.search;
      router.push(`/connexion?next=${encodeURIComponent(here)}`);
      return {};
    }
    if (result.error) {
      setIds(before);
      return { error: result.error };
    }
    setIds((current) => {
      const next = new Set(current ?? []);
      if (result.inList) next.add(productId);
      else next.delete(productId);
      return next;
    });
    router.refresh();
    return {};
  }

  return <Context.Provider value={{ ids, toggle }}>{children}</Context.Provider>;
}

/** Cœur « Ma liste » : icône (cartes produit) ou bouton libellé (fiche). */
export function WishlistButton({
  productId,
  initialInList = false,
  variant = "icon",
  className,
}: {
  productId: string;
  /** État connu côté serveur (fiche produit), avant chargement de la liste. */
  initialInList?: boolean;
  variant?: "icon" | "button";
  className?: string;
}) {
  const context = useContext(Context);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inList = context?.ids ? context.ids.has(productId) : initialInList;
  const Heart = inList ? HeartSolid : HeartOutline;
  const label = inList ? "Retirer de ma liste" : "Ajouter à ma liste";

  async function onClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (!context || pending) return;
    setPending(true);
    setError(null);
    const result = await context.toggle(productId);
    setPending(false);
    if (result.error) setError(result.error);
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={inList}
        title={error ?? label}
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-navy-deep/70 backdrop-blur transition-colors hover:bg-navy-deep/90",
          inList ? "text-danger" : "text-ink hover:text-danger",
          pending && "opacity-60",
          className,
        )}
      >
        <Heart className="size-5" />
      </button>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={inList}
        disabled={pending}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md border px-5 py-3 font-label text-sm font-semibold tracking-wide transition-colors disabled:opacity-60",
          inList
            ? "border-danger/50 bg-danger/10 text-danger hover:bg-danger/15"
            : "border-white/15 text-ink hover:border-danger/50 hover:text-danger",
        )}
      >
        <Heart className="size-5" />
        {inList ? "Dans ma liste" : "Ma liste"}
      </button>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

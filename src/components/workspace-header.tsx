"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  /** Actif uniquement sur l'URL exacte (ex. tableau de bord racine). */
  exact?: boolean;
  /** Pastille (ex. nombre de tâches en attente). */
  badge?: number;
};

/**
 * En-tête commun des espaces de travail (vendeur, livreur, admin) : marque,
 * navigation à état actif et lien de retour. Client pour surligner l'onglet
 * courant via usePathname.
 */
export function WorkspaceHeader({
  accent,
  items,
  back,
}: {
  accent: string;
  items: WorkspaceNavItem[];
  back: { href: string; label: string };
}) {
  const pathname = usePathname();
  const isActive = (item: WorkspaceNavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-deep/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-(--container-page) items-center justify-between gap-4 px-4 py-3.5 md:px-10">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/"
            className="shrink-0 font-display text-lg font-extrabold"
          >
            Deal Lomé <span className="text-gold">{accent}</span>
          </Link>
          <nav className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1">
            {items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 font-label text-sm whitespace-nowrap transition-colors",
                    active
                      ? "bg-gold/10 font-semibold text-gold"
                      : "text-ink-muted hover:bg-white/5 hover:text-ink",
                  )}
                >
                  {item.label}
                  {item.badge ? (
                    <span className="rounded-full bg-gold px-1.5 py-0.5 font-label text-[10px] font-bold text-navy-deep">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
        <Link
          href={back.href}
          className="shrink-0 font-label text-sm whitespace-nowrap text-ink-muted transition-colors hover:text-emerald"
        >
          {back.label}
        </Link>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type AccountNavItem = {
  href: string;
  label: string;
  icon: string;
  /** Pastille d'état affichée à droite (ex. « En attente »). */
  badge?: string;
};

export type AccountNavGroup = {
  title?: string;
  items: AccountNavItem[];
};

function isActive(pathname: string, href: string) {
  // `/compte` ne doit pas rester actif sur toutes ses sous-pages.
  if (href === "/compte") return pathname === "/compte";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Navigation verticale de la sidebar (desktop). */
export function AccountNav({ groups }: { groups: AccountNavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6">
      {groups.map((group, gi) => (
        <div key={group.title ?? gi}>
          {group.title ? (
            <p className="mb-2 px-3 font-label text-[11px] font-semibold tracking-widest text-ink-muted/70 uppercase">
              {group.title}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 font-label text-sm transition-colors",
                      active
                        ? "bg-gold/10 font-semibold text-gold"
                        : "text-ink-muted hover:bg-white/5 hover:text-ink",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      className={cn("size-4.5", active ? "text-gold" : "")}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 font-label text-[10px] font-semibold text-ink-muted">
                        {item.badge}
                      </span>
                    ) : null}
                    {active ? (
                      <span className="h-4 w-0.5 rounded-full bg-gold" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Pills horizontales défilantes (mobile/tablette). */
export function AccountNavMobile({ groups }: { groups: AccountNavGroup[] }) {
  const pathname = usePathname();
  const items = groups.flatMap((g) => g.items);

  return (
    <nav className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-label text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-gold font-semibold text-navy-deep"
                : "glass text-ink-muted hover:text-ink",
            )}
          >
            <Icon name={item.icon} className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

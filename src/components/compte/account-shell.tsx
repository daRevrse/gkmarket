import Link from "next/link";
import {
  AccountNav,
  AccountNavMobile,
  type AccountNavGroup,
} from "@/components/compte/account-nav";
import { SiteHeader } from "@/components/site-header";
import type { CurrentUser } from "@/lib/auth";

const pendingLabel: Record<string, string> = {
  pending: "En attente",
  rejected: "Refusé",
  suspended: "Suspendu",
};

function initials(name: string | null) {
  if (!name) return "DL";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/**
 * Coquille commune des espaces connectés (compte, vendeur, livreur) : header
 * public + sidebar unique dont les groupes s'adaptent aux casquettes
 * approuvées. Les liens « devenir vendeur/livreur » restent discrets en pied
 * de navigation. L'admin garde son layout dédié (/admin).
 */
export function AccountShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const groups: AccountNavGroup[] = [
    {
      title: "Mon espace",
      items: [
        { href: "/compte", label: "Aperçu", icon: "activity" },
        { href: "/compte/profil", label: "Mon profil", icon: "user" },
        { href: "/compte/commandes", label: "Mes commandes", icon: "package" },
        { href: "/compte/wallet", label: "Mon wallet", icon: "wallet" },
        { href: "/compte/adresses", label: "Mes adresses", icon: "map-pin" },
        { href: "/compte/notifications", label: "Notifications", icon: "bell" },
      ],
    },
  ];

  if (user.sellerProfile?.status === "approved") {
    groups.push({
      title: "Espace vendeur",
      items: [
        {
          href: "/vendeur",
          label: "Tableau de bord",
          icon: "trending-up",
          exact: true,
        },
        { href: "/vendeur/produits", label: "Mes produits", icon: "bag" },
        {
          href: "/vendeur/commandes",
          label: "Commandes reçues",
          icon: "package",
        },
        {
          href: `/boutique/${user.sellerProfile.id}`,
          label: "Ma boutique",
          icon: "home",
          newTab: true,
        },
      ],
    });
  }

  if (user.courierProfile?.status === "approved") {
    groups.push({
      title: "Espace livreur",
      items: [
        { href: "/livreur/courses", label: "Mes courses", icon: "truck" },
      ],
    });
  }

  if (user.isAdmin) {
    groups.push({
      items: [{ href: "/admin", label: "Administration", icon: "shield" }],
    });
  }

  // Liens discrets vers les candidatures (jamais mis en avant).
  const becomeLinks = [
    !user.sellerProfile || user.sellerProfile.status === "rejected"
      ? { href: "/compte/devenir-vendeur", label: "Devenir vendeur" }
      : user.sellerProfile.status !== "approved"
        ? {
            href: "/compte/devenir-vendeur",
            label: `Vendeur : ${pendingLabel[user.sellerProfile.status] ?? user.sellerProfile.status}`,
          }
        : null,
    !user.courierProfile || user.courierProfile.status === "rejected"
      ? { href: "/compte/devenir-livreur", label: "Devenir livreur" }
      : user.courierProfile.status !== "approved"
        ? {
            href: "/compte/devenir-livreur",
            label: `Livreur : ${pendingLabel[user.courierProfile.status] ?? user.courierProfile.status}`,
          }
        : null,
  ].filter((l): l is { href: string; label: string } => l !== null);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="mx-auto flex w-full max-w-(--container-page) flex-1 gap-10 px-4 py-8 md:px-10">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-8 flex flex-col gap-6">
            <div className="glass rounded-xl p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-gold/40 bg-gold/10 font-display text-sm font-extrabold text-gold">
                  {initials(user.fullName)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {user.fullName ?? "Mon compte"}
                  </p>
                  <p className="truncate font-label text-xs text-ink-muted">
                    {user.email ?? user.phone}
                  </p>
                </div>
              </div>
            </div>
            <AccountNav groups={groups} />
            {becomeLinks.length > 0 ? (
              <div className="border-t border-white/[0.06] px-3 pt-4">
                {becomeLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block py-1 font-label text-xs text-ink-muted/80 transition-colors hover:text-emerald"
                  >
                    {link.label} ›
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <div className="mb-6 lg:hidden">
            <AccountNavMobile groups={groups} />
            {becomeLinks.length > 0 ? (
              <div className="mt-2 flex gap-4 px-1">
                {becomeLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="font-label text-xs text-ink-muted/80 hover:text-emerald"
                  >
                    {link.label} ›
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

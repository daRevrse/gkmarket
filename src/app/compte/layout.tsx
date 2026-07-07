import { redirect } from "next/navigation";
import {
  AccountNav,
  AccountNavMobile,
  type AccountNavGroup,
} from "@/components/compte/account-nav";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

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

// Coquille commune de l'espace compte : sidebar identité + navigation
// (desktop) ou pills défilantes (mobile), les pages restent inchangées.
export default async function CompteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const groups: AccountNavGroup[] = [
    {
      title: "Mon espace",
      items: [
        { href: "/compte", label: "Aperçu", icon: "activity" },
        { href: "/compte/commandes", label: "Mes commandes", icon: "package" },
        { href: "/compte/wallet", label: "Mon wallet", icon: "wallet" },
        { href: "/compte/adresses", label: "Mes adresses", icon: "map-pin" },
        {
          href: "/compte/notifications",
          label: "Notifications",
          icon: "bell",
        },
      ],
    },
    {
      title: "Mes casquettes",
      items: [
        user.sellerProfile?.status === "approved"
          ? { href: "/vendeur/produits", label: "Espace vendeur", icon: "bag" }
          : {
              href: "/compte/devenir-vendeur",
              label: "Devenir vendeur",
              icon: "bag",
              badge: user.sellerProfile
                ? pendingLabel[user.sellerProfile.status]
                : undefined,
            },
        user.courierProfile?.status === "approved"
          ? { href: "/livreur/courses", label: "Espace livreur", icon: "truck" }
          : {
              href: "/compte/devenir-livreur",
              label: "Devenir livreur",
              icon: "truck",
              badge: user.courierProfile
                ? pendingLabel[user.courierProfile.status]
                : undefined,
            },
        ...(user.isAdmin
          ? [{ href: "/admin", label: "Administration", icon: "shield" }]
          : []),
      ],
    },
  ];

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
          </div>
        </aside>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <div className="mb-6 lg:hidden">
            <AccountNavMobile groups={groups} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

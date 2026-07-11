import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, disputes, sellerProfiles } from "@/db/schema";
import {
  AccountNav,
  AccountNavMobile,
  type AccountNavGroup,
} from "@/components/compte/account-nav";
import { getCurrentUser } from "@/lib/auth";

// Espace admin : sidebar dédiée (même langage visuel que l'espace compte),
// avec compteurs de tâches en attente sur les entrées concernées.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  const [[pendingSellers], [pendingCouriers], [openDisputes]] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(sellerProfiles)
        .where(eq(sellerProfiles.status, "pending")),
      db
        .select({ value: count() })
        .from(courierProfiles)
        .where(eq(courierProfiles.status, "pending")),
      db
        .select({ value: count() })
        .from(disputes)
        .where(eq(disputes.status, "open")),
    ]);

  const badge = (n: number) => (n > 0 ? String(n) : undefined);

  const groups: AccountNavGroup[] = [
    {
      title: "Marketplace",
      items: [
        { href: "/admin", label: "Vue d'ensemble", icon: "activity", exact: true },
        { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "user" },
        {
          href: "/admin/vendeurs",
          label: "Vendeurs",
          icon: "bag",
          badge: badge(pendingSellers.value),
        },
        {
          href: "/admin/livreurs",
          label: "Livreurs",
          icon: "truck",
          badge: badge(pendingCouriers.value),
        },
        {
          href: "/admin/litiges",
          label: "Litiges",
          icon: "shield",
          badge: badge(openDisputes.value),
        },
      ],
    },
    {
      title: "Catalogue & ventes",
      items: [
        { href: "/admin/produits", label: "Produits", icon: "basket" },
        { href: "/admin/categories", label: "Catégories", icon: "tag" },
        { href: "/admin/commandes", label: "Commandes", icon: "package" },
        { href: "/admin/financier", label: "Financier", icon: "wallet" },
        { href: "/admin/rapports", label: "Rapports", icon: "trending-up" },
      ],
    },
    {
      title: "Système",
      items: [
        { href: "/admin/parametres", label: "Paramètres", icon: "more-vertical" },
        { href: "/admin/journal", label: "Journal", icon: "search" },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-(--container-page) flex-1 gap-10 px-4 py-8 md:px-10">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-8 flex flex-col gap-6">
            <div className="glass rounded-xl p-5">
              <Link href="/admin" className="font-display text-lg font-extrabold">
                Deal Lomé <span className="text-gold">Admin</span>
              </Link>
              <p className="mt-1 truncate font-label text-xs text-ink-muted">
                {user.fullName ?? user.email ?? "Administrateur"}
              </p>
            </div>
            <AccountNav groups={groups} />
            <div className="border-t border-white/[0.06] px-3 pt-4">
              <Link
                href="/compte"
                className="block py-1 font-label text-xs text-ink-muted/80 transition-colors hover:text-emerald"
              >
                ‹ Retour au site
              </Link>
            </div>
          </div>
        </aside>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <div className="mb-6 flex flex-col gap-2 lg:hidden">
            <div className="flex items-center justify-between gap-4">
              <Link href="/admin" className="font-display font-extrabold">
                Deal Lomé <span className="text-gold">Admin</span>
              </Link>
              <Link
                href="/compte"
                className="font-label text-xs text-ink-muted hover:text-emerald"
              >
                ‹ Retour au site
              </Link>
            </div>
            <AccountNavMobile groups={groups} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

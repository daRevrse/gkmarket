import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-white/10 bg-white/[0.03]">
        <div className="mx-auto flex w-full max-w-(--container-page) items-center justify-between gap-4 px-4 py-4 md:px-10">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-display text-lg font-extrabold">
              GK Market <span className="text-gold">Admin</span>
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              {[
                { href: "/admin/utilisateurs", label: "Utilisateurs" },
                { href: "/admin/vendeurs", label: "Vendeurs" },
                { href: "/admin/livreurs", label: "Livreurs" },
                { href: "/admin/produits", label: "Produits" },
                { href: "/admin/commandes", label: "Commandes" },
                { href: "/admin/litiges", label: "Litiges" },
                { href: "/admin/financier", label: "Financier" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-ink-muted transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href="/compte"
            className="text-sm text-ink-muted transition-colors hover:text-emerald"
          >
            ← Retour au site
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

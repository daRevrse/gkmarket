import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, disputes, sellerProfiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { WorkspaceHeader } from "@/components/workspace-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) redirect("/");

  // Compteurs de tâches en attente, affichés en pastille sur la navigation.
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

  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader
        accent="Admin"
        items={[
          { href: "/admin", label: "Vue d'ensemble", exact: true },
          { href: "/admin/utilisateurs", label: "Utilisateurs" },
          {
            href: "/admin/vendeurs",
            label: "Vendeurs",
            badge: pendingSellers.value || undefined,
          },
          {
            href: "/admin/livreurs",
            label: "Livreurs",
            badge: pendingCouriers.value || undefined,
          },
          { href: "/admin/produits", label: "Produits" },
          { href: "/admin/commandes", label: "Commandes" },
          {
            href: "/admin/litiges",
            label: "Litiges",
            badge: openDisputes.value || undefined,
          },
          { href: "/admin/financier", label: "Financier" },
        ]}
        back={{ href: "/compte", label: "‹ Retour au site" }}
      />
      {children}
    </div>
  );
}

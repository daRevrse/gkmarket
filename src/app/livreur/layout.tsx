import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WorkspaceHeader } from "@/components/workspace-header";

// Espace réservé aux livreurs approuvés.
export default async function LivreurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.courierProfile?.status !== "approved") {
    redirect("/compte/devenir-livreur");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader
        accent="Livreur"
        items={[
          { href: "/livreur/courses", label: "Mes courses" },
          { href: "/compte/wallet", label: "Mes gains" },
          { href: "/compte/profil", label: "Profil" },
        ]}
        back={{ href: "/compte", label: "‹ Mon compte" }}
      />
      {children}
    </div>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WorkspaceHeader } from "@/components/workspace-header";

// Espace réservé aux vendeurs approuvés.
export default async function VendeurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.sellerProfile?.status !== "approved") {
    redirect("/compte/devenir-vendeur");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <WorkspaceHeader
        accent="Vendeur"
        items={[
          { href: "/vendeur/produits", label: "Produits" },
          { href: "/vendeur/commandes", label: "Commandes" },
          { href: `/boutique/${user.sellerProfile.id}`, label: "Ma boutique" },
          { href: "/compte/profil", label: "Profil & versement" },
        ]}
        back={{ href: "/compte", label: "‹ Mon compte" }}
      />
      {children}
    </div>
  );
}

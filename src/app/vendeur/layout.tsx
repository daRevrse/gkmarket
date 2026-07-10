import { redirect } from "next/navigation";
import { AccountShell } from "@/components/compte/account-shell";
import { getCurrentUser } from "@/lib/auth";

// Espace réservé aux vendeurs approuvés, rendu dans la coquille compte
// commune (sidebar avec le groupe « Espace vendeur »).
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

  return <AccountShell user={user}>{children}</AccountShell>;
}

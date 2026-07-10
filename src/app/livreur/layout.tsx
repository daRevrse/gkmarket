import { redirect } from "next/navigation";
import { AccountShell } from "@/components/compte/account-shell";
import { getCurrentUser } from "@/lib/auth";

// Espace réservé aux livreurs approuvés, rendu dans la coquille compte
// commune (sidebar avec le groupe « Espace livreur »).
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

  return <AccountShell user={user}>{children}</AccountShell>;
}

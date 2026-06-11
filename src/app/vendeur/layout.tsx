import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

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
  return <>{children}</>;
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

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
  return <>{children}</>;
}

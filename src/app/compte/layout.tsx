import { redirect } from "next/navigation";
import { AccountShell } from "@/components/compte/account-shell";
import { getCurrentUser } from "@/lib/auth";

export default async function CompteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  return <AccountShell user={user}>{children}</AccountShell>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AddressManager } from "./address-manager";

export default async function AdressesPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const { retour } = await searchParams;
  // Lien de retour restreint aux pages internes connues (pas de redirection ouverte).
  const backHref = retour === "/commande" ? "/commande" : "/compte";
  const backLabel =
    retour === "/commande" ? "‹ Retour à la commande" : "‹ Mon compte";

  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href={backHref}
          className="text-sm text-ink-muted hover:text-emerald"
        >
          {backLabel}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Mes adresses de livraison
        </h1>
        <p className="mt-1 text-ink-muted">
          Gérez les adresses utilisées pour vos commandes.
        </p>
      </div>
      <AddressManager
        initialAddresses={rows.map((row) => ({
          id: row.id,
          label: row.label,
          recipientName: row.recipientName,
          recipientPhone: row.recipientPhone,
          city: row.city,
          district: row.district,
          details: row.details,
          isDefault: row.isDefault,
        }))}
      />
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { addresses } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AddressManager } from "./address-manager";

export default async function AdressesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, user.id))
    .orderBy(desc(addresses.isDefault), desc(addresses.createdAt));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mon compte
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

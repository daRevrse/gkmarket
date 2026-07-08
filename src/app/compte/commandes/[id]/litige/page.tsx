import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { disputes, orders, sellerProfiles } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { DisputeForm } from "./dispute-form";

export default async function OuvrirLitigePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { id } = await params;

  const [row] = await db
    .select({ order: orders, shopName: sellerProfiles.shopName })
    .from(orders)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, orders.sellerId))
    .where(and(eq(orders.id, id), eq(orders.buyerId, user.id)))
    .limit(1);
  if (!row) notFound();

  // Litige déjà ouvert : rediriger vers son fil.
  const [existing] = await db
    .select({ id: disputes.id })
    .from(disputes)
    .where(eq(disputes.orderId, id))
    .limit(1);
  if (existing) redirect(`/litiges/${existing.id}`);

  if (!["paid", "processing", "shipped"].includes(row.order.status)) {
    redirect(`/compte/commandes/${id}`);
  }

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href={`/compte/commandes/${id}`}
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Commande {row.order.number}
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Ouvrir un litige
        </h1>
        <p className="mt-1 text-ink-muted">
          Commande {row.order.number} chez {row.shopName}. À l&apos;ouverture
          du litige, les fonds sont bloqués jusqu&apos;à la résolution
          — le vendeur ne sera pas payé tant que le problème n&apos;est pas
          tranché.
        </p>
      </div>

      <Card>
        <DisputeForm orderId={row.order.id} />
      </Card>

      <p className="mt-4 text-xs text-ink-muted">
        Comment ça marche : 1. vous décrivez le problème avec vos preuves —
        2. le vendeur est invité à répondre — 3. si aucun accord n&apos;est
        trouvé, l&apos;équipe Deal Lomé tranche (remboursement total, partiel
        ou rejet du litige).
      </p>
    </main>
  );
}

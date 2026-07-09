import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, sellerProfiles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { nouveau } = await searchParams;

  const rows = await db
    .select({
      order: orders,
      shopName: sellerProfiles.shopName,
    })
    .from(orders)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, orders.sellerId))
    .where(eq(orders.buyerId, user.id))
    .orderBy(desc(orders.createdAt));

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Mon compte
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Mes commandes
        </h1>
      </div>

      {nouveau ? (
        <p className="mb-6 rounded-md border border-emerald/40 bg-emerald/10 px-4 py-3 text-sm text-emerald-light">
          Votre commande a bien été enregistrée ! Suivez son avancement
          ci-dessous - si elle est payée, les fonds restent sécurisés
          jusqu&apos;à votre confirmation de réception.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Vous n&apos;avez pas encore passé de commande.
          </p>
          <LinkButton href="/produits" className="mt-4">
            Explorer le catalogue
          </LinkButton>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ order, shopName }) => {
            const status = orderStatusLabels[order.status] ?? {
              label: order.status,
            };
            return (
              <Link key={order.id} href={`/compte/commandes/${order.id}`}>
                <Card className="flex flex-wrap items-center justify-between gap-3 transition-colors hover:border-emerald/40">
                  <div>
                    <p className="font-display font-bold">{order.number}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {shopName} ·{" "}
                      {order.createdAt.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display font-bold text-gold">
                      {formatFcfa(order.totalFcfa)}
                    </span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

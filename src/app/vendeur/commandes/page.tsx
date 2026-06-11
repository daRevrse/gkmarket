import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";

export default async function VendeurCommandesPage() {
  const user = await getCurrentUser();

  const rows = await db
    .select({
      order: orders,
      buyerName: users.fullName,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.buyerId))
    .where(eq(orders.sellerId, user!.sellerProfile!.id))
    .orderBy(desc(orders.createdAt));

  const items =
    rows.length > 0
      ? await db
          .select()
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              rows.map((row) => row.order.id),
            ),
          )
      : [];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/vendeur/produits"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mes produits
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Commandes reçues
        </h1>
        <p className="mt-1 text-ink-muted">
          Le traitement des commandes (préparation, expédition) s&apos;activera
          avec le paiement Escrow.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">Aucune commande pour le moment.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {rows.map(({ order, buyerName }) => {
            const status = orderStatusLabels[order.status] ?? {
              label: order.status,
            };
            const orderLines = items.filter(
              (item) => item.orderId === order.id,
            );
            return (
              <Card key={order.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-display font-bold">{order.number}</p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {buyerName ?? "Acheteur"} ·{" "}
                      {order.createdAt.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      · livraison : {order.shippingCity}
                      {order.shippingDistrict
                        ? ` (${order.shippingDistrict})`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display font-bold text-gold">
                      {formatFcfa(order.totalFcfa)}
                    </span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>
                <ul className="mt-3 border-t border-white/[0.06] pt-3 text-sm text-ink-muted">
                  {orderLines.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.title} —{" "}
                      {formatFcfa(item.totalFcfa)}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, sellerProfiles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";

export default async function CommandeDetailPage({
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

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id));

  const status = orderStatusLabels[row.order.status] ?? {
    label: row.order.status,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/compte/commandes"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mes commandes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-extrabold">
            {row.order.number}
          </h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="mt-1 text-ink-muted">
          Vendu par {row.shopName} · commandée le{" "}
          {row.order.createdAt.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="p-0">
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-4">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-md bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  {item.productId ? (
                    <Link
                      href={`/produits/${item.productId}`}
                      className="block truncate text-sm font-medium hover:text-emerald"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">{item.title}</p>
                  )}
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {item.quantity} × {formatFcfa(item.unitPriceFcfa)}
                  </p>
                </div>
                <span className="font-display font-bold text-gold">
                  {formatFcfa(item.totalFcfa)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/[0.06] px-5 py-4 text-sm">
            <p className="flex justify-between text-ink-muted">
              <span>Sous-total</span>
              <span>{formatFcfa(row.order.subtotalFcfa)}</span>
            </p>
            <p className="flex justify-between text-ink-muted">
              <span>Livraison</span>
              <span>{formatFcfa(row.order.deliveryFeeFcfa)}</span>
            </p>
            <p className="mt-2 flex justify-between font-display text-lg font-extrabold">
              <span>Total</span>
              <span className="text-gold">{formatFcfa(row.order.totalFcfa)}</span>
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold">
            Adresse de livraison
          </h2>
          <p className="mt-2 text-sm">
            {row.order.shippingName} — {row.order.shippingPhone}
          </p>
          <p className="text-sm text-ink-muted">
            {[
              row.order.shippingCity,
              row.order.shippingDistrict,
              row.order.shippingDetails,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Card>
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  deliveries,
  disputes,
  orderItems,
  orders,
  sellerProfiles,
  users,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { deliveryStatusLabels, vehicleTypeLabels } from "@/lib/deliveries";
import { disputeReasonLabels, disputeStatusLabels } from "@/lib/disputes";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";
import { OrderActions } from "./order-actions";

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

  // Course de livraison en cours ou effectuée (les refus ne concernent que
  // le vendeur).
  const [deliveryRow] = await db
    .select({
      delivery: deliveries,
      courierName: users.fullName,
      vehicleType: courierProfiles.vehicleType,
    })
    .from(deliveries)
    .innerJoin(courierProfiles, eq(courierProfiles.id, deliveries.courierId))
    .innerJoin(users, eq(users.id, courierProfiles.userId))
    .where(
      and(
        eq(deliveries.orderId, id),
        inArray(deliveries.status, ["accepted", "picked_up", "delivered"]),
      ),
    )
    .limit(1);

  const [dispute] = await db
    .select()
    .from(disputes)
    .where(eq(disputes.orderId, id))
    .limit(1);

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
            {row.order.paidAt ? (
              <a
                href={`/api/factures/${row.order.id}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-md border border-emerald px-3 py-1.5 text-sm text-emerald hover:bg-emerald/10"
              >
                Télécharger la facture (PDF)
              </a>
            ) : null}
          </div>
        </Card>

        <OrderActions orderId={row.order.id} status={row.order.status} />

        {dispute ? (
          <Card className="border-gold/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-bold">Litige</h2>
                  <Badge
                    variant={disputeStatusLabels[dispute.status]?.variant}
                  >
                    {disputeStatusLabels[dispute.status]?.label ??
                      dispute.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {disputeReasonLabels[dispute.reason] ?? dispute.reason} ·
                  ouvert le {dispute.createdAt.toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Link
                href={`/litiges/${dispute.id}`}
                className="text-sm text-emerald hover:underline"
              >
                Suivre le litige →
              </Link>
            </div>
          </Card>
        ) : ["paid", "processing", "shipped"].includes(row.order.status) ? (
          <p className="text-sm text-ink-muted">
            Un problème avec cette commande ?{" "}
            <Link
              href={`/compte/commandes/${row.order.id}/litige`}
              className="text-emerald hover:underline"
            >
              Ouvrir un litige
            </Link>{" "}
            — les fonds Escrow seront bloqués jusqu&apos;à la résolution.
          </p>
        ) : null}

        {deliveryRow ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold">
                Suivi de livraison
              </h2>
              <Badge
                variant={
                  deliveryStatusLabels[deliveryRow.delivery.status]?.variant
                }
              >
                {deliveryStatusLabels[deliveryRow.delivery.status]?.label ??
                  deliveryRow.delivery.status}
              </Badge>
            </div>
            <p className="mt-2 text-sm">
              Livreur : {deliveryRow.courierName ?? "—"} (
              {vehicleTypeLabels[deliveryRow.vehicleType] ??
                deliveryRow.vehicleType}
              )
            </p>
            <ul className="mt-2 text-sm text-ink-muted">
              {deliveryRow.delivery.acceptedAt ? (
                <li>
                  Course acceptée le{" "}
                  {deliveryRow.delivery.acceptedAt.toLocaleString("fr-FR")}
                </li>
              ) : null}
              {deliveryRow.delivery.pickedUpAt ? (
                <li>
                  Colis récupéré chez le vendeur le{" "}
                  {deliveryRow.delivery.pickedUpAt.toLocaleString("fr-FR")}
                </li>
              ) : null}
              {deliveryRow.delivery.deliveredAt ? (
                <li>
                  Colis remis
                  {deliveryRow.delivery.recipientName
                    ? ` à ${deliveryRow.delivery.recipientName}`
                    : ""}{" "}
                  le {deliveryRow.delivery.deliveredAt.toLocaleString("fr-FR")}
                </li>
              ) : null}
            </ul>
            {deliveryRow.delivery.proofPhotoPath ? (
              <a
                href={`/api/proofs?path=${encodeURIComponent(deliveryRow.delivery.proofPhotoPath)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-md border border-emerald px-3 py-1.5 text-sm text-emerald hover:bg-emerald/10"
              >
                Photo du colis remis
              </a>
            ) : null}
          </Card>
        ) : null}

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

import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courierProfiles,
  deliveries,
  disputes,
  orderItems,
  orders,
  users,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { deliveryStatusLabels } from "@/lib/deliveries";
import { disputeReasonLabels, disputeStatusLabels } from "@/lib/disputes";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";
import { SellerOrderActions } from "./seller-order-actions";

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

  const orderIds = rows.map((row) => row.order.id);
  const items =
    orderIds.length > 0
      ? await db
          .select()
          .from(orderItems)
          .where(inArray(orderItems.orderId, orderIds))
      : [];

  // Dernière course par commande (les refus restent visibles pour proposer
  // la course à un autre livreur).
  const courierUsers = users;
  const deliveryRows =
    orderIds.length > 0
      ? await db
          .select({
            delivery: deliveries,
            courierName: courierUsers.fullName,
          })
          .from(deliveries)
          .innerJoin(courierProfiles, eq(courierProfiles.id, deliveries.courierId))
          .innerJoin(courierUsers, eq(courierUsers.id, courierProfiles.userId))
          .where(inArray(deliveries.orderId, orderIds))
          .orderBy(desc(deliveries.createdAt))
      : [];
  const latestDelivery = new Map<
    string,
    (typeof deliveryRows)[number]
  >();
  for (const row of deliveryRows) {
    if (!latestDelivery.has(row.delivery.orderId)) {
      latestDelivery.set(row.delivery.orderId, row);
    }
  }

  const disputeRows =
    orderIds.length > 0
      ? await db
          .select()
          .from(disputes)
          .where(inArray(disputes.orderId, orderIds))
      : [];
  const disputeByOrder = new Map(
    disputeRows.map((dispute) => [dispute.orderId, dispute]),
  );

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/vendeur/produits"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Mes produits
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Commandes reçues
        </h1>
        <p className="mt-1 text-ink-muted">
          Préparez vos commandes payées, puis demandez un livreur (ou expédiez
          vous-même). Les fonds sont versés à la réception.
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
            const deliveryRow = latestDelivery.get(order.id) ?? null;
            const deliveryStatus = deliveryRow
              ? deliveryStatusLabels[deliveryRow.delivery.status] ?? {
                  label: deliveryRow.delivery.status,
                }
              : null;
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
                      {item.quantity} × {item.title} -{" "}
                      {formatFcfa(item.totalFcfa)}
                    </li>
                  ))}
                </ul>
                {order.paidAt ? (
                  <a
                    href={`/api/factures/${order.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-sm text-emerald hover:underline"
                  >
                    Facture PDF ›
                  </a>
                ) : null}

                {deliveryRow && deliveryStatus ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-sm">
                    <Badge variant={deliveryStatus.variant}>
                      {deliveryStatus.label}
                    </Badge>
                    <span className="text-ink-muted">
                      Livreur : {deliveryRow.courierName ?? "-"}
                      {deliveryRow.delivery.status === "refused" &&
                      deliveryRow.delivery.refusalReason
                        ? ` - motif : ${deliveryRow.delivery.refusalReason}`
                        : ""}
                    </span>
                  </div>
                ) : null}

                {(() => {
                  const dispute = disputeByOrder.get(order.id);
                  if (!dispute) return null;
                  const disputeStatus = disputeStatusLabels[dispute.status];
                  return (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Badge variant={disputeStatus?.variant}>
                          {disputeStatus?.label ?? dispute.status}
                        </Badge>
                        <span className="text-ink-muted">
                          {disputeReasonLabels[dispute.reason] ?? dispute.reason}
                        </span>
                      </span>
                      <Link
                        href={`/litiges/${dispute.id}`}
                        className="text-emerald hover:underline"
                      >
                        {dispute.status === "open"
                          ? "Répondre au litige ›"
                          : "Voir le litige ›"}
                      </Link>
                    </div>
                  );
                })()}

                <SellerOrderActions
                  orderId={order.id}
                  status={order.status}
                  deliveryStatus={deliveryRow?.delivery.status ?? null}
                />
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

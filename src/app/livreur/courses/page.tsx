import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deliveries, orders, sellerProfiles } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { deliveryStatusLabels } from "@/lib/deliveries";
import { formatFcfa } from "@/lib/format";
import { CourseActions } from "./course-actions";

const ACTIVE_STATUSES = ["proposed", "accepted", "picked_up"];

export default async function LivreurCoursesPage() {
  const user = await getCurrentUser();

  const rows = await db
    .select({
      delivery: deliveries,
      order: orders,
      shopName: sellerProfiles.shopName,
      shopCity: sellerProfiles.city,
      shopDistrict: sellerProfiles.district,
      shopPhone: sellerProfiles.contactPhone,
    })
    .from(deliveries)
    .innerJoin(orders, eq(orders.id, deliveries.orderId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, deliveries.sellerId))
    .where(eq(deliveries.courierId, user!.courierProfile!.id))
    .orderBy(desc(deliveries.createdAt));

  const active = rows.filter((row) =>
    ACTIVE_STATUSES.includes(row.delivery.status),
  );
  const history = rows.filter(
    (row) => !ACTIVE_STATUSES.includes(row.delivery.status),
  );

  const totalEarned = history
    .filter(
      (row) =>
        row.delivery.status === "delivered" && row.order.status === "delivered",
    )
    .reduce((sum, row) => sum + row.delivery.feeFcfa, 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href="/compte"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ← Mon compte
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-extrabold">Mes courses</h1>
          <Link href="/compte/wallet" className="text-sm text-emerald hover:underline">
            Gains versés : {formatFcfa(totalEarned)} — voir mon wallet →
          </Link>
        </div>
        <p className="mt-1 text-ink-muted">
          Acceptez les courses proposées par les vendeurs, récupérez le colis,
          remettez-le avec preuve. Vos gains sont versés à la confirmation de
          réception par l&apos;acheteur.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Aucune course pour le moment. Les vendeurs vous proposeront des
            livraisons selon votre zone.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <h2 className="mb-4 font-display text-xl font-bold">
              Courses en cours ({active.length})
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-ink-muted">Aucune course en cours.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {active.map((row) => (
                  <CourseCard key={row.delivery.id} row={row} />
                ))}
              </div>
            )}
          </section>

          {history.length > 0 ? (
            <section>
              <h2 className="mb-4 font-display text-xl font-bold">
                Historique ({history.length})
              </h2>
              <div className="flex flex-col gap-4">
                {history.map((row) => (
                  <CourseCard key={row.delivery.id} row={row} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}

function CourseCard({
  row,
}: {
  row: {
    delivery: typeof deliveries.$inferSelect;
    order: typeof orders.$inferSelect;
    shopName: string;
    shopCity: string;
    shopDistrict: string | null;
    shopPhone: string | null;
  };
}) {
  const { delivery, order } = row;
  const status = deliveryStatusLabels[delivery.status] ?? {
    label: delivery.status,
  };
  // Les coordonnées complètes du destinataire ne sont visibles qu'une fois
  // la course acceptée.
  const accepted =
    delivery.status === "accepted" ||
    delivery.status === "picked_up" ||
    delivery.status === "delivered";

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-bold">{order.number}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Proposée le{" "}
            {delivery.createdAt.toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-display font-bold text-gold">
            + {formatFcfa(delivery.feeFcfa)}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
      </div>

      <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium">Enlèvement</p>
          <p className="mt-1 text-ink-muted">
            {row.shopName} —{" "}
            {[row.shopCity, row.shopDistrict].filter(Boolean).join(" · ")}
            {row.shopPhone ? ` · ${row.shopPhone}` : ""}
          </p>
        </div>
        <div>
          <p className="font-medium">Livraison</p>
          <p className="mt-1 text-ink-muted">
            {[order.shippingCity, order.shippingDistrict]
              .filter(Boolean)
              .join(" · ")}
            {accepted ? (
              <>
                <br />
                {order.shippingName} — {order.shippingPhone}
                {order.shippingDetails ? (
                  <>
                    <br />
                    {order.shippingDetails}
                  </>
                ) : null}
              </>
            ) : (
              <span className="block text-xs">
                (coordonnées complètes visibles après acceptation)
              </span>
            )}
          </p>
        </div>
      </div>

      {delivery.status === "delivered" ? (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm text-ink-muted">
          Remis à {delivery.recipientName}
          {delivery.deliveredAt
            ? ` le ${delivery.deliveredAt.toLocaleString("fr-FR")}`
            : ""}
          {" — "}
          {order.status === "delivered"
            ? "gain versé sur votre wallet ✓"
            : "en attente de confirmation par l'acheteur."}
        </p>
      ) : null}
      {delivery.status === "refused" && delivery.refusalReason ? (
        <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm text-ink-muted">
          Refusée : {delivery.refusalReason}
        </p>
      ) : null}

      <CourseActions deliveryId={delivery.id} status={delivery.status} />
    </Card>
  );
}

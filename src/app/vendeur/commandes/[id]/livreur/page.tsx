import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, deliveries, orders, users } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { requireApprovedSeller } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { CourierPicker, type CourierCandidate } from "./courier-picker";

/**
 * Proposition intelligente de livreurs (cf. docs/CHANGEMENTS.md §3) :
 * les livreurs approuvés sont classés par proximité avec l'adresse de
 * livraison (ville, puis quartier/zone desservie) et par disponibilité
 * (moins de courses actives = mieux classé). Le vendeur choisit.
 */
export default async function ChoixLivreurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireApprovedSeller();
  const { id } = await params;

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.sellerId, user.sellerProfile.id)))
    .limit(1);
  if (!order) notFound();
  if (order.status !== "paid" && order.status !== "processing") {
    redirect("/vendeur/commandes");
  }

  // Une course active rend cette page inutile ; les refus précédents
  // excluent le livreur concerné de la nouvelle proposition.
  const orderDeliveries = await db
    .select({ courierId: deliveries.courierId, status: deliveries.status })
    .from(deliveries)
    .where(eq(deliveries.orderId, order.id));
  if (orderDeliveries.some((d) => d.status !== "refused" && d.status !== "cancelled")) {
    redirect("/vendeur/commandes");
  }
  const refusedCourierIds = orderDeliveries
    .filter((d) => d.status === "refused")
    .map((d) => d.courierId);

  // Livreurs approuvés + leur charge actuelle (courses non terminées).
  const activeCount = sql<number>`(
    SELECT count(*)::int FROM deliveries d
    WHERE d.courier_id = ${courierProfiles.id}
      AND d.status IN ('proposed', 'accepted', 'picked_up')
  )`;
  const rows = await db
    .select({
      profile: courierProfiles,
      fullName: users.fullName,
      activeCourses: activeCount,
    })
    .from(courierProfiles)
    .innerJoin(users, eq(users.id, courierProfiles.userId))
    .where(
      and(
        eq(courierProfiles.status, "approved"),
        // Pas soi-même, pas ceux qui ont déjà refusé cette course
        ne(courierProfiles.userId, user!.id),
        refusedCourierIds.length > 0
          ? notInArray(courierProfiles.id, refusedCourierIds)
          : undefined,
        // Garde-fou : seuls les livreurs encore actifs côté compte
        inArray(
          courierProfiles.userId,
          db.select({ id: users.id }).from(users).where(eq(users.status, "active")),
        ),
      ),
    );

  // Score de pertinence : ville de livraison, puis quartier dans la zone.
  const city = order.shippingCity.trim().toLowerCase();
  const district = order.shippingDistrict?.trim().toLowerCase() ?? null;
  const candidates: CourierCandidate[] = rows
    .map((row) => {
      let score = 0;
      if (row.profile.city.trim().toLowerCase() === city) score += 2;
      const zone = [row.profile.district, row.profile.serviceArea]
        .filter(Boolean)
        .join(", ")
        .toLowerCase();
      if (district && zone.includes(district)) score += 1;
      return {
        id: row.profile.id,
        name: row.fullName ?? "Livreur",
        vehicleType: row.profile.vehicleType,
        city: row.profile.city,
        district: row.profile.district,
        serviceArea: row.profile.serviceArea,
        contactPhone: row.profile.contactPhone,
        activeCourses: row.activeCourses,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.activeCourses - b.activeCourses);

  return (
    <main className="w-full max-w-3xl flex-1">
      <div className="mb-8">
        <Link
          href="/vendeur/commandes"
          className="text-sm text-ink-muted hover:text-emerald"
        >
          ‹ Commandes reçues
        </Link>
        <h1 className="mt-2 font-display text-3xl font-extrabold">
          Demander un livreur
        </h1>
        <p className="mt-1 text-ink-muted">
          Commande {order.number} - à livrer à {order.shippingCity}
          {order.shippingDistrict ? ` (${order.shippingDistrict})` : ""}. Le
          livreur recevra {formatFcfa(order.deliveryFeeFcfa)} (les frais de
          livraison), versés à la confirmation de réception.
        </p>
      </div>

      {candidates.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Aucun livreur disponible pour le moment. Vous pouvez expédier la
            commande vous-même depuis vos commandes.
          </p>
        </Card>
      ) : (
        <CourierPicker orderId={order.id} candidates={candidates} />
      )}
    </main>
  );
}

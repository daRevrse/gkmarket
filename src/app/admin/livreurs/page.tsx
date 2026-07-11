import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, users } from "@/db/schema";
import { CourierReviewCard, type CourierApplication } from "./review-card";

export default async function AdminLivreursPage() {
  const rows = await db
    .select()
    .from(courierProfiles)
    .innerJoin(users, eq(users.id, courierProfiles.userId))
    .orderBy(
      // Les demandes à traiter d'abord
      sql`CASE WHEN ${courierProfiles.status} = 'pending' THEN 0 ELSE 1 END`,
      desc(courierProfiles.createdAt),
    );

  const applications: CourierApplication[] = rows.map((row) => ({
    id: row.courier_profiles.id,
    vehicleType: row.courier_profiles.vehicleType,
    city: row.courier_profiles.city,
    district: row.courier_profiles.district,
    serviceArea: row.courier_profiles.serviceArea,
    contactPhone: row.courier_profiles.contactPhone,
    idDocumentPath: row.courier_profiles.idDocumentPath,
    status: row.courier_profiles.status,
    rejectionReason: row.courier_profiles.rejectionReason,
    createdAt: row.courier_profiles.createdAt.toISOString(),
    applicantName: row.users.fullName,
    applicantEmail: row.users.email,
    applicantPhone: row.users.phone,
  }));

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">
          Demandes livreurs
        </h1>
        <p className="mt-1 text-ink-muted">
          {pendingCount > 0
            ? `${pendingCount} demande${pendingCount > 1 ? "s" : ""} en attente de validation.`
            : "Aucune demande en attente."}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {applications.length === 0 ? (
          <p className="text-ink-muted">
            Aucune demande livreur pour le moment.
          </p>
        ) : (
          applications.map((application) => (
            <CourierReviewCard key={application.id} application={application} />
          ))
        )}
      </div>
    </main>
  );
}

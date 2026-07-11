import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { sellerProfiles, users } from "@/db/schema";
import { ReviewCard, type SellerApplication } from "./review-card";

export default async function AdminVendeursPage() {
  const rows = await db
    .select()
    .from(sellerProfiles)
    .innerJoin(users, eq(users.id, sellerProfiles.userId))
    .orderBy(
      // Les demandes à traiter d'abord
      sql`CASE WHEN ${sellerProfiles.status} = 'pending' THEN 0 ELSE 1 END`,
      desc(sellerProfiles.createdAt),
    );

  const applications: SellerApplication[] = rows.map((row) => ({
    id: row.seller_profiles.id,
    shopName: row.seller_profiles.shopName,
    shopDescription: row.seller_profiles.shopDescription,
    city: row.seller_profiles.city,
    district: row.seller_profiles.district,
    contactPhone: row.seller_profiles.contactPhone,
    rccm: row.seller_profiles.rccm,
    idDocumentPath: row.seller_profiles.idDocumentPath,
    rccmDocumentPath: row.seller_profiles.rccmDocumentPath,
    addressDocumentPath: row.seller_profiles.addressDocumentPath,
    payoutMethod: row.seller_profiles.payoutMethod,
    status: row.seller_profiles.status,
    rejectionReason: row.seller_profiles.rejectionReason,
    createdAt: row.seller_profiles.createdAt.toISOString(),
    applicantName: row.users.fullName,
    applicantEmail: row.users.email,
    applicantPhone: row.users.phone,
  }));

  const pendingCount = applications.filter((a) => a.status === "pending").length;

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">
          Demandes vendeurs
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
            Aucune demande vendeur pour le moment.
          </p>
        ) : (
          applications.map((application) => (
            <ReviewCard key={application.id} application={application} />
          ))
        )}
      </div>
    </main>
  );
}

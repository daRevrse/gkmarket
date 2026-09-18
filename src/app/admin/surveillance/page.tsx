import Link from "next/link";
import { count, desc, eq, isNotNull, max, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { contactViolations, sellerProfiles, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

const statusLabel: Record<string, string> = {
  suspended: "Suspendu",
  banned: "Banni",
  deleted: "Supprimé",
};

/**
 * Surveillance anti-contournement (docs/CHANGEMENTS.md §5) : comptes ayant
 * tenté de partager des coordonnées. Les messages concernés ont été bloqués ;
 * l'admin examine, lève la surveillance ou sanctionne.
 */
export default async function AdminSurveillancePage() {
  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      phone: users.phone,
      status: users.status,
      watchedAt: users.watchedAt,
      shopName: sellerProfiles.shopName,
      total: count(contactViolations.id),
      open: sql<number>`count(*) filter (where ${contactViolations.reviewedAt} is null)`.mapWith(Number),
      lastAt: max(contactViolations.createdAt),
    })
    .from(users)
    .innerJoin(contactViolations, eq(contactViolations.userId, users.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .groupBy(users.id, sellerProfiles.shopName)
    // Sous surveillance, ou tentatives encore à examiner.
    .having(
      or(
        isNotNull(users.watchedAt),
        sql`count(*) filter (where ${contactViolations.reviewedAt} is null) > 0`,
      ),
    )
    .orderBy(desc(max(contactViolations.createdAt)))
    .limit(100);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Surveillance</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Comptes ayant tenté de partager des coordonnées (téléphone, email,
          liens, autres messageries) dans un message, une fiche produit ou leur
          boutique. Les contenus ont été bloqués ; examinez-les, puis levez la
          surveillance ou sanctionnez depuis Utilisateurs.
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">Aucun compte sous surveillance.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Link key={row.id} href={`/admin/surveillance/${row.id}`}>
              <Card className="p-4 transition-colors hover:border-emerald/40">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {row.fullName ?? "(sans nom)"}
                      </p>
                      {row.watchedAt ? (
                        <Badge variant="wholesale">Sous surveillance</Badge>
                      ) : null}
                      {row.status !== "active" ? (
                        <Badge variant="neutral">
                          {statusLabel[row.status] ?? row.status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {[row.email, row.phone].filter(Boolean).join(" · ") || "-"}
                      {row.shopName ? ` · Boutique : ${row.shopName}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold">
                      {row.total} tentative{row.total > 1 ? "s" : ""}
                    </p>
                    <p className="font-label text-xs text-ink-muted">
                      {row.open > 0 ? `${row.open} à examiner · ` : ""}
                      dernière le{" "}
                      {row.lastAt?.toLocaleDateString("fr-FR") ?? "-"}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminLogs, users } from "@/db/schema";
import { Card } from "@/components/ui/card";

const typeLabel: Record<string, string> = {
  vendeur: "Vendeur",
  livreur: "Livreur",
  utilisateur: "Utilisateur",
  produit: "Produit",
  litige: "Litige",
  categorie: "Catégorie",
  parametres: "Paramètres",
};

export default async function AdminJournalPage() {
  const rows = await db
    .select({ log: adminLogs, adminName: users.fullName, adminEmail: users.email })
    .from(adminLogs)
    .innerJoin(users, eq(users.id, adminLogs.adminId))
    .orderBy(desc(adminLogs.createdAt))
    .limit(200);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">
          Journal d&apos;activité
        </h1>
        <p className="mt-1 text-ink-muted">
          Les 200 dernières actions d&apos;administration (validations,
          suspensions, arbitrages, paramètres).
        </p>
      </div>

      {rows.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Aucune action journalisée pour le moment.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {rows.map(({ log, adminName, adminEmail }) => (
              <div
                key={log.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3"
              >
                <span className="font-label text-xs whitespace-nowrap text-ink-muted">
                  {log.createdAt.toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-sm font-medium">{log.action}</span>
                {log.targetType ? (
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-label text-[10px] font-semibold text-ink-muted">
                    {typeLabel[log.targetType] ?? log.targetType}
                  </span>
                ) : null}
                {log.details ? (
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                    {log.details}
                  </span>
                ) : null}
                <span className="ml-auto font-label text-xs text-ink-muted">
                  par {adminName ?? adminEmail ?? "admin"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </main>
  );
}

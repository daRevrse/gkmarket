import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { courierProfiles, sellerProfiles, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserActions } from "./user-actions";

const statusLabel: Record<
  string,
  { label: string; variant?: "verified" | "wholesale" | "neutral" }
> = {
  active: { label: "Actif", variant: "verified" },
  suspended: { label: "Suspendu", variant: "wholesale" },
  banned: { label: "Banni", variant: "neutral" },
  deleted: { label: "Supprimé", variant: "neutral" },
};

export default async function AdminUtilisateursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const params = await searchParams;

  const filters: SQL[] = [];
  if (params.q?.trim()) {
    const pattern = `%${params.q.trim()}%`;
    filters.push(
      or(
        ilike(users.fullName, pattern),
        ilike(users.email, pattern),
        ilike(users.phone, pattern),
      )!,
    );
  }
  if (
    params.statut &&
    ["active", "suspended", "banned", "deleted"].includes(params.statut)
  ) {
    filters.push(
      eq(users.status, params.statut as "active" | "suspended" | "banned" | "deleted"),
    );
  }

  const rows = await db
    .select({
      user: users,
      shopName: sellerProfiles.shopName,
      sellerStatus: sellerProfiles.status,
      courierStatus: courierProfiles.status,
    })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .leftJoin(courierProfiles, eq(courierProfiles.userId, users.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Utilisateurs</h1>
        <p className="mt-1 text-ink-muted">
          {rows.length} compte{rows.length > 1 ? "s" : ""} affiché
          {rows.length > 1 ? "s" : ""} (100 max - affinez la recherche).
        </p>
      </div>

      <form action="/admin/utilisateurs" className="mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          name="q"
          defaultValue={params.q}
          placeholder="Nom, email ou téléphone…"
          className="w-64 rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none"
        />
        <select
          name="statut"
          defaultValue={params.statut ?? ""}
          className="rounded-md border border-white/10 bg-navy-deep px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="banned">Bannis</option>
          <option value="deleted">Supprimés</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-navy-deep hover:bg-gold-light"
        >
          Rechercher
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {rows.length === 0 ? (
          <p className="text-ink-muted">Aucun utilisateur trouvé.</p>
        ) : (
          rows.map(({ user, shopName, sellerStatus, courierStatus }) => {
            const status = statusLabel[user.status] ?? { label: user.status };
            return (
              <Card key={user.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {user.fullName ?? "(sans nom)"}
                      </p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {user.isAdmin ? <Badge variant="wholesale">Admin</Badge> : null}
                      {shopName && sellerStatus === "approved" ? (
                        <Badge variant="verified">Vendeur</Badge>
                      ) : null}
                      {courierStatus === "approved" ? (
                        <Badge variant="verified">Livreur</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {[user.email, user.phone].filter(Boolean).join(" · ") ||
                        "-"}
                      {shopName ? ` · Boutique : ${shopName}` : ""}
                      {" · inscrit le "}
                      {user.createdAt.toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <UserActions
                    userId={user.id}
                    status={user.status}
                    isAdmin={user.isAdmin}
                  />
                </div>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}

import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { disputes, orders, sellerProfiles, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  disputeReasonLabels,
  disputeResolutionLabels,
  disputeStatusLabels,
} from "@/lib/disputes";
import { formatFcfa } from "@/lib/format";

export default async function AdminLitigesPage() {
  const rows = await db
    .select({
      dispute: disputes,
      order: orders,
      shopName: sellerProfiles.shopName,
      buyerName: users.fullName,
    })
    .from(disputes)
    .innerJoin(orders, eq(orders.id, disputes.orderId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, disputes.sellerId))
    .innerJoin(users, eq(users.id, disputes.buyerId))
    .orderBy(
      // Les litiges à trancher d'abord
      sql`CASE WHEN ${disputes.status} = 'open' THEN 0 ELSE 1 END`,
      desc(disputes.createdAt),
    );

  const openCount = rows.filter((row) => row.dispute.status === "open").length;
  const blockedFcfa = rows
    .filter((row) => row.dispute.status === "open")
    .reduce((sum, row) => sum + row.order.totalFcfa, 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Litiges</h1>
        <p className="mt-1 text-ink-muted">
          {openCount > 0
            ? `${openCount} litige${openCount > 1 ? "s" : ""} en cours - ${formatFcfa(blockedFcfa)} bloqués.`
            : "Aucun litige en cours."}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {rows.length === 0 ? (
          <p className="text-ink-muted">Aucun litige pour le moment.</p>
        ) : (
          rows.map(({ dispute, order, shopName, buyerName }) => {
            const status = disputeStatusLabels[dispute.status] ?? {
              label: dispute.status,
            };
            return (
              <Link key={dispute.id} href={`/litiges/${dispute.id}`} className="group">
                <Card className="transition-colors group-hover:bg-white/[0.06]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <p className="font-display font-bold">{order.number}</p>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {disputeReasonLabels[dispute.reason] ?? dispute.reason} ·{" "}
                        {buyerName ?? "Acheteur"} contre {shopName} · ouvert le{" "}
                        {dispute.createdAt.toLocaleDateString("fr-FR")}
                      </p>
                      {dispute.status === "resolved" && dispute.resolution ? (
                        <p className="mt-1 text-sm text-ink-muted">
                          › {disputeResolutionLabels[dispute.resolution]}
                          {dispute.refundFcfa
                            ? ` (${formatFcfa(dispute.refundFcfa)})`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <span className="font-display font-bold text-gold">
                      {formatFcfa(order.totalFcfa)}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}

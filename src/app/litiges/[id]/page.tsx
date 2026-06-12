import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  disputeEvidence,
  disputeMessages,
  disputes,
  orders,
  sellerProfiles,
  users,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import {
  disputeReasonLabels,
  disputeResolutionLabels,
  disputeStatusLabels,
} from "@/lib/disputes";
import { formatFcfa } from "@/lib/format";
import { DecisionPanel } from "./decision-panel";
import { MessageForm } from "./message-form";

export default async function LitigePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  const { id } = await params;

  const buyerUsers = users;
  const [row] = await db
    .select({
      dispute: disputes,
      order: orders,
      shopName: sellerProfiles.shopName,
      sellerUserId: sellerProfiles.userId,
      buyerName: buyerUsers.fullName,
    })
    .from(disputes)
    .innerJoin(orders, eq(orders.id, disputes.orderId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, disputes.sellerId))
    .innerJoin(buyerUsers, eq(buyerUsers.id, disputes.buyerId))
    .where(eq(disputes.id, id))
    .limit(1);
  if (!row) notFound();

  const { dispute, order } = row;
  const isBuyer = dispute.buyerId === user.id;
  const isSeller = row.sellerUserId === user.id;
  if (!isBuyer && !isSeller && !user.isAdmin) notFound();

  const [evidence, messages] = await Promise.all([
    db
      .select()
      .from(disputeEvidence)
      .where(eq(disputeEvidence.disputeId, id))
      .orderBy(asc(disputeEvidence.position)),
    db
      .select({ message: disputeMessages, author: users })
      .from(disputeMessages)
      .innerJoin(users, eq(users.id, disputeMessages.authorId))
      .where(eq(disputeMessages.disputeId, id))
      .orderBy(asc(disputeMessages.createdAt)),
  ]);

  const status = disputeStatusLabels[dispute.status] ?? {
    label: dispute.status,
  };
  const backLink = user.isAdmin
    ? { href: "/admin/litiges", label: "← Litiges" }
    : isBuyer
      ? {
          href: `/compte/commandes/${order.id}`,
          label: `← Commande ${order.number}`,
        }
      : { href: "/vendeur/commandes", label: "← Commandes reçues" };

  function authorTag(author: typeof users.$inferSelect) {
    if (author.isAdmin) return "Deal Lomé";
    if (author.id === dispute.buyerId) return "Acheteur";
    if (author.id === row.sellerUserId) return "Vendeur";
    return "";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 md:px-10">
      <div className="mb-8">
        <Link
          href={backLink.href}
          className="text-sm text-ink-muted hover:text-emerald"
        >
          {backLink.label}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-extrabold">
            Litige — {order.number}
          </h1>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <p className="mt-1 text-ink-muted">
          {row.buyerName ?? "Acheteur"} contre {row.shopName} · commande de{" "}
          {formatFcfa(order.totalFcfa)} · ouvert le{" "}
          {dispute.createdAt.toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <h2 className="font-display text-lg font-bold">
            {disputeReasonLabels[dispute.reason] ?? dispute.reason}
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {dispute.description}
          </p>
          {evidence.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {evidence.map((item, index) => (
                <a
                  key={item.id}
                  href={`/api/disputes/evidence?path=${encodeURIComponent(item.path)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-emerald px-3 py-1.5 text-sm text-emerald hover:bg-emerald/10"
                >
                  Preuve {index + 1}
                </a>
              ))}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-ink-muted">
            Fonds Escrow bloqués : {formatFcfa(order.totalFcfa)}. Résolution en
            3 phases — dialogue entre les parties, médiation Deal Lomé,
            décision administrative.
          </p>
        </Card>

        {dispute.status === "resolved" ? (
          <Card className="border-emerald/40">
            <h2 className="font-display text-lg font-bold">Décision finale</h2>
            <p className="mt-2 text-sm font-medium">
              {dispute.resolution
                ? disputeResolutionLabels[dispute.resolution]
                : "—"}
              {dispute.refundFcfa
                ? ` — ${formatFcfa(dispute.refundFcfa)} remboursés`
                : ""}
            </p>
            {dispute.decisionNote ? (
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
                {dispute.decisionNote}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-ink-muted">
              Tranché le{" "}
              {dispute.resolvedAt?.toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </Card>
        ) : null}

        <Card>
          <h2 className="font-display text-lg font-bold">Échanges</h2>
          {messages.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              Aucun message pour le moment.
              {isSeller
                ? " Répondez à l'acheteur pour tenter de résoudre le problème à l'amiable."
                : ""}
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {messages.map(({ message, author }) => (
                <div
                  key={message.id}
                  className="rounded-md border border-white/[0.06] bg-white/[0.03] px-4 py-3"
                >
                  <p className="text-xs text-ink-muted">
                    <span className="font-medium text-ink">
                      {author.fullName ?? "—"}
                    </span>{" "}
                    · {authorTag(author)} ·{" "}
                    {message.createdAt.toLocaleString("fr-FR")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {message.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {dispute.status === "open" ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <MessageForm disputeId={dispute.id} />
            </div>
          ) : null}
        </Card>

        {user.isAdmin && dispute.status === "open" ? (
          <Card className="border-gold/30">
            <h2 className="font-display text-lg font-bold">
              Arbitrage Deal Lomé
            </h2>
            <p className="mt-1 mb-4 text-sm text-ink-muted">
              La décision exécute immédiatement les mouvements de fonds et
              clôt le litige.
            </p>
            <DecisionPanel
              disputeId={dispute.id}
              subtotalFcfa={order.subtotalFcfa}
              totalFcfa={order.totalFcfa}
            />
          </Card>
        ) : null}
      </div>
    </main>
  );
}

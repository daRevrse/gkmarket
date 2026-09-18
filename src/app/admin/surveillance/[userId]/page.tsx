import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  contactViolations,
  conversations,
  sellerProfiles,
  users,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CONTACT_REASON_LABELS, type ContactReason } from "@/lib/contact-guard";
import { UserActions } from "../../utilisateurs/user-actions";
import { WatchActions } from "../watch-actions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const statusLabel: Record<string, string> = {
  active: "actif",
  suspended: "suspendu",
  banned: "banni",
  deleted: "supprimé",
};

const contextLabel: Record<string, string> = {
  message: "Message",
  product: "Fiche produit",
  shop: "Boutique",
  profile: "Profil",
};

function formatDateTime(date: Date) {
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminSurveillanceUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  if (!UUID_RE.test(userId)) notFound();

  const [row] = await db
    .select({ user: users, shop: sellerProfiles })
    .from(users)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) notFound();
  const { user, shop } = row;

  const buyerSide = db
    .select({
      id: conversations.id,
      lastMessageAt: conversations.lastMessageAt,
      counterpart: sellerProfiles.shopName,
    })
    .from(conversations)
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, conversations.sellerId))
    .where(eq(conversations.buyerId, userId));

  const [violations, asBuyer, asSeller] = await Promise.all([
    db
      .select()
      .from(contactViolations)
      .where(eq(contactViolations.userId, userId))
      .orderBy(desc(contactViolations.createdAt))
      .limit(100),
    buyerSide.orderBy(desc(conversations.lastMessageAt)).limit(50),
    shop
      ? db
          .select({
            id: conversations.id,
            lastMessageAt: conversations.lastMessageAt,
            counterpart: users.fullName,
          })
          .from(conversations)
          .innerJoin(users, eq(users.id, conversations.buyerId))
          .where(eq(conversations.sellerId, shop.id))
          .orderBy(desc(conversations.lastMessageAt))
          .limit(50)
      : Promise.resolve([]),
  ]);

  const openCount = violations.filter((v) => !v.reviewedAt).length;
  const conversationRows = [
    ...asBuyer.map((c) => ({ ...c, role: "acheteur", counterpart: c.counterpart })),
    ...asSeller.map((c) => ({
      ...c,
      role: "vendeur",
      counterpart: c.counterpart ?? "Acheteur",
    })),
  ].sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

  return (
    <main className="w-full flex-1">
      <Link
        href="/admin/surveillance"
        className="text-sm text-ink-muted hover:text-emerald"
      >
        ‹ Surveillance
      </Link>

      <div className="mt-2 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-extrabold">
              {user.fullName ?? "(sans nom)"}
            </h1>
            {user.watchedAt ? (
              <Badge variant="wholesale">
                Sous surveillance depuis le{" "}
                {user.watchedAt.toLocaleDateString("fr-FR")}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {[user.email, user.phone].filter(Boolean).join(" · ") || "-"}
            {shop ? ` · Boutique : ${shop.shopName}` : ""} · compte{" "}
            {statusLabel[user.status] ?? user.status}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <WatchActions
            userId={user.id}
            openCount={openCount}
            watched={user.watchedAt !== null}
          />
          <UserActions
            userId={user.id}
            status={user.status}
            isAdmin={user.isAdmin}
          />
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold">
          Tentatives bloquées ({violations.length})
        </h2>
        {violations.length === 0 ? (
          <p className="text-ink-muted">Aucune tentative enregistrée.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {violations.map((violation) => (
              <Card key={violation.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-label text-xs text-ink-muted">
                    {formatDateTime(violation.createdAt)}
                  </span>
                  <Badge variant="neutral">
                    {contextLabel[violation.context] ?? violation.context}
                  </Badge>
                  {violation.reasons.map((reason) => (
                    <Badge key={reason} variant="wholesale">
                      {CONTACT_REASON_LABELS[reason as ContactReason] ?? reason}
                    </Badge>
                  ))}
                  {violation.reviewedAt ? (
                    <span className="text-xs text-ink-muted">· examinée</span>
                  ) : null}
                  {violation.conversationId ? (
                    <Link
                      href={`/admin/conversations/${violation.conversationId}`}
                      className="ml-auto font-label text-xs text-emerald hover:underline"
                    >
                      Voir la conversation ›
                    </Link>
                  ) : null}
                </div>
                <p className="mt-2 rounded-md bg-white/[0.03] p-3 text-sm break-words whitespace-pre-line">
                  {violation.excerpt}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">
          Conversations ({conversationRows.length})
        </h2>
        {conversationRows.length === 0 ? (
          <p className="text-ink-muted">Aucune conversation.</p>
        ) : (
          <Card className="p-0">
            <div className="flex flex-col divide-y divide-white/[0.04]">
              {conversationRows.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/admin/conversations/${conversation.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span>
                    <span className="font-medium">
                      {conversation.counterpart}
                    </span>
                    <span className="text-sm text-ink-muted">
                      {" "}
                      · en tant que {conversation.role}
                    </span>
                  </span>
                  <span className="font-label text-xs text-ink-muted">
                    {conversation.lastMessageAt.toLocaleDateString("fr-FR")}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>
    </main>
  );
}

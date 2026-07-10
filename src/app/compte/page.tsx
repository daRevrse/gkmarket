import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { db } from "@/db";
import { notifications, orders, sellerProfiles, wallets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";
import { orderStatusLabels } from "@/lib/orders";

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const [[walletRow], [ordersRow], [notifsRow], recentOrders] =
    await Promise.all([
      db
        .select({ balance: wallets.balanceFcfa })
        .from(wallets)
        .where(eq(wallets.userId, user.id)),
      db
        .select({ n: count() })
        .from(orders)
        .where(
          and(
            eq(orders.buyerId, user.id),
            inArray(orders.status, [
              "pending_payment",
              "paid",
              "processing",
              "shipped",
              "disputed",
            ]),
          ),
        ),
      db
        .select({ n: count() })
        .from(notifications)
        .where(
          and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
        ),
      db
        .select({ order: orders, shopName: sellerProfiles.shopName })
        .from(orders)
        .innerJoin(sellerProfiles, eq(sellerProfiles.id, orders.sellerId))
        .where(eq(orders.buyerId, user.id))
        .orderBy(desc(orders.createdAt))
        .limit(4),
    ]);

  const stats = [
    {
      href: "/compte/wallet",
      icon: "wallet",
      label: "Solde wallet",
      value: formatFcfa(walletRow?.balance ?? 0),
      accent: "text-gold",
      iconBg: "bg-gold/10 text-gold",
    },
    {
      href: "/compte/commandes",
      icon: "package",
      label: "Commandes en cours",
      value: String(ordersRow?.n ?? 0),
      accent: "text-ink",
      iconBg: "bg-emerald/10 text-emerald",
    },
    {
      href: "/compte/notifications",
      icon: "bell",
      label: "Notifications non lues",
      value: String(notifsRow?.n ?? 0),
      accent: "text-ink",
      iconBg: "bg-white/5 text-ink-muted",
    },
  ];

  return (
    <main className="flex-1">
      <EmailVerificationBanner />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-label text-xs font-semibold tracking-widest text-ink-muted uppercase">
            Aperçu
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold">
            Bonjour{user.fullName ? `, ${user.fullName}` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href="/compte/profil" size="sm" variant="secondary">
            <Icon name="user" className="size-4" />
            Modifier mon profil
          </LinkButton>
          <LogoutButton />
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s, i) => (
          <Link
            key={s.href}
            href={s.href}
            className="fade-up group"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <div className="glass h-full rounded-xl p-5 transition-colors group-hover:border-gold/40">
              <div className="flex items-center justify-between">
                <span
                  className={`flex size-9 items-center justify-center rounded-md ${s.iconBg}`}
                >
                  <Icon name={s.icon} className="size-4.5" />
                </span>
                <Icon
                  name="chevron-right"
                  className="size-4 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              <p
                className={`mt-4 font-display text-2xl font-extrabold ${s.accent}`}
              >
                {s.value}
              </p>
              <p className="mt-1 font-label text-xs font-semibold tracking-wider text-ink-muted uppercase">
                {s.label}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Dernières commandes */}
      <div className="mt-10 mb-4 flex items-end justify-between gap-4">
        <h2 className="font-display text-xl font-bold">Dernières commandes</h2>
        {recentOrders.length > 0 ? (
          <Link
            href="/compte/commandes"
            className="font-label text-sm text-emerald hover:underline"
          >
            Tout voir ›
          </Link>
        ) : null}
      </div>
      {recentOrders.length === 0 ? (
        <Card className="text-center">
          <p className="text-ink-muted">
            Vous n&apos;avez pas encore passé de commande.
          </p>
          <LinkButton href="/produits" size="sm" className="mt-4">
            Parcourir le catalogue
          </LinkButton>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="flex flex-col divide-y divide-white/[0.04]">
            {recentOrders.map(({ order, shopName }) => {
              const status = orderStatusLabels[order.status] ?? {
                label: order.status,
              };
              return (
                <Link
                  key={order.id}
                  href={`/compte/commandes/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold">{order.number}</p>
                    <p className="mt-0.5 truncate text-sm text-ink-muted">
                      {shopName} ·{" "}
                      {order.createdAt.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-gold">
                      {formatFcfa(order.totalFcfa)}
                    </span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </main>
  );
}

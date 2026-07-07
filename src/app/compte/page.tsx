import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { DeleteAccount } from "@/components/auth/delete-account";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { LogoutButton } from "@/components/auth/logout-button";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { db } from "@/db";
import { notifications, orders, wallets } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatFcfa } from "@/lib/format";

const profileStatusLabel: Record<string, string> = {
  pending: "En attente de validation",
  approved: "Vérifié",
  rejected: "Refusé",
  suspended: "Suspendu",
};

export default async function ComptePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");

  const [[walletRow], [ordersRow], [notifsRow]] = await Promise.all([
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
  ]);

  const stats = [
    {
      href: "/compte/wallet",
      icon: "wallet",
      label: "Solde wallet",
      value: formatFcfa(walletRow?.balance ?? 0),
      hint: "Gérer mon wallet",
      accent: "text-gold",
      iconBg: "bg-gold/10 text-gold",
    },
    {
      href: "/compte/commandes",
      icon: "package",
      label: "Commandes en cours",
      value: String(ordersRow?.n ?? 0),
      hint: "Suivre mes commandes",
      accent: "text-ink",
      iconBg: "bg-emerald/10 text-emerald",
    },
    {
      href: "/compte/notifications",
      icon: "bell",
      label: "Notifications non lues",
      value: String(notifsRow?.n ?? 0),
      hint: "Ouvrir la cloche",
      accent: "text-ink",
      iconBg: "bg-white/5 text-ink-muted",
    },
  ];

  const roles = [
    {
      icon: "basket",
      title: "Acheteur",
      desc: "Achetez auprès de vendeurs vérifiés, payez en Escrow.",
      state: <Badge variant="verified">Actif</Badge>,
      cta: (
        <LinkButton href="/produits" size="sm" variant="ghost">
          Parcourir le catalogue
          <Icon name="chevron-right" className="size-4" />
        </LinkButton>
      ),
    },
    {
      icon: "bag",
      title: "Vendeur",
      desc: "Ouvrez votre boutique et vendez partout au Togo.",
      state: user.sellerProfile ? (
        <Badge
          variant={
            user.sellerProfile.status === "approved" ? "verified" : "neutral"
          }
        >
          {profileStatusLabel[user.sellerProfile.status]}
        </Badge>
      ) : (
        <Badge variant="neutral">Non activé</Badge>
      ),
      cta:
        user.sellerProfile?.status === "approved" ? (
          <LinkButton href="/vendeur/produits" size="sm" variant="secondary">
            Espace vendeur
            <Icon name="chevron-right" className="size-4" />
          </LinkButton>
        ) : (
          <LinkButton
            href="/compte/devenir-vendeur"
            size="sm"
            variant="secondary"
          >
            {user.sellerProfile ? "Voir ma demande" : "Devenir vendeur"}
          </LinkButton>
        ),
    },
    {
      icon: "truck",
      title: "Livreur",
      desc: "Livrez les commandes et encaissez les frais de course.",
      state: user.courierProfile ? (
        <Badge
          variant={
            user.courierProfile.status === "approved" ? "verified" : "neutral"
          }
        >
          {profileStatusLabel[user.courierProfile.status]}
        </Badge>
      ) : (
        <Badge variant="neutral">Non activé</Badge>
      ),
      cta:
        user.courierProfile?.status === "approved" ? (
          <LinkButton href="/livreur/courses" size="sm" variant="secondary">
            Espace livreur
            <Icon name="chevron-right" className="size-4" />
          </LinkButton>
        ) : (
          <LinkButton
            href="/compte/devenir-livreur"
            size="sm"
            variant="secondary"
          >
            {user.courierProfile ? "Voir ma demande" : "Devenir livreur"}
          </LinkButton>
        ),
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
        <LogoutButton />
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

      {/* Casquettes */}
      <h2 className="mt-10 mb-4 font-display text-xl font-bold">
        Mes casquettes
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        {roles.map((r, i) => (
          <div
            key={r.title}
            className="fade-up glass flex flex-col rounded-xl p-5"
            style={{ animationDelay: `${210 + i * 70}ms` }}
          >
            <div className="flex items-start justify-between">
              <span className="flex size-10 items-center justify-center rounded-md bg-white/5 text-gold">
                <Icon name={r.icon} className="size-5" />
              </span>
              {r.state}
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">{r.title}</h3>
            <p className="mt-1 flex-1 text-sm text-ink-muted">{r.desc}</p>
            <div className="mt-4">{r.cta}</div>
          </div>
        ))}
      </div>

      {/* Administration */}
      {user.isAdmin ? (
        <Card className="mt-10 border-gold/30" glow>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
                <Icon name="shield" className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">
                  Administration
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Validation des vendeurs et gestion de la marketplace.
                </p>
              </div>
            </div>
            <LinkButton href="/admin" size="sm">
              Ouvrir l&apos;admin
              <Icon name="chevron-right" className="size-4" />
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <div className="mt-10">
        <DeleteAccount />
      </div>
    </main>
  );
}

import Link from "next/link";
import {
  BellIcon,
  ShoppingCartIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

/** En-tête public : logo, recherche globale, panier, accès compte. */
export async function SiteHeader({ query }: { query?: string }) {
  const user = await getCurrentUser();

  let cartCount = 0;
  let unreadCount = 0;
  if (user) {
    const [[cartRow], [unreadRow]] = await Promise.all([
      db
        .select({
          count: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int`,
        })
        .from(cartItems)
        .where(eq(cartItems.userId, user.id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(
          and(eq(notifications.userId, user.id), isNull(notifications.readAt)),
        ),
    ]);
    cartCount = cartRow?.count ?? 0;
    unreadCount = unreadRow?.count ?? 0;
  }

  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-(--container-page) flex-wrap items-center gap-4 px-4 py-4 md:px-10">
        <Link href="/" className="font-display text-xl font-extrabold">
          Deal <span className="text-gold">Lomé</span>
        </Link>
        <form action="/produits" className="min-w-48 flex-1">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Rechercher un produit…"
            className="w-full rounded-md border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 focus:border-emerald focus:outline-none"
          />
        </form>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/produits"
            aria-label="Catalogue"
            title="Catalogue"
            className="rounded-md p-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <Squares2X2Icon className="size-5.5" />
          </Link>
          <Link
            href="/panier"
            aria-label="Panier"
            title="Panier"
            className="relative rounded-md p-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
          >
            <ShoppingCartIcon className="size-5.5" />
            {cartCount > 0 ? (
              <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-deep">
                {cartCount}
              </span>
            ) : null}
          </Link>
          {user ? (
            <Link
              href="/compte/notifications"
              aria-label="Notifications"
              title="Notifications"
              className="relative rounded-md p-2 text-ink-muted transition-colors hover:bg-white/5 hover:text-ink"
            >
              <BellIcon className="size-5.5" />
              {unreadCount > 0 ? (
                <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald px-1 text-[10px] font-bold text-navy-deep">
                  {unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}
          {user ? (
            <Link
              href="/compte"
              aria-label="Mon compte"
              title="Mon compte"
              className="rounded-md p-2 text-emerald transition-colors hover:bg-emerald/10"
            >
              <UserCircleIcon className="size-6" />
            </Link>
          ) : (
            <Link
              href="/connexion"
              aria-label="Se connecter"
              title="Se connecter"
              className="ml-1 inline-flex items-center gap-2 rounded-full bg-gold px-3 py-2 font-label text-sm font-semibold text-navy-deep transition-colors hover:bg-gold-light sm:px-3.5"
            >
              <UserIcon className="size-5" />
              <span className="hidden sm:inline">Se connecter</span>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems } from "@/db/schema";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

/** En-tête public : logo, recherche globale, panier, accès compte. */
export async function SiteHeader({ query }: { query?: string }) {
  const user = await getCurrentUser();

  let cartCount = 0;
  if (user) {
    const [row] = await db
      .select({ count: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
      .from(cartItems)
      .where(eq(cartItems.userId, user.id));
    cartCount = row?.count ?? 0;
  }

  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-(--container-page) flex-wrap items-center gap-4 px-4 py-4 md:px-10">
        <Link href="/" className="font-display text-xl font-extrabold">
          GK <span className="text-gold">Market</span>
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
        <nav className="flex items-center gap-3">
          <Link
            href="/produits"
            className="text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Catalogue
          </Link>
          <Link
            href="/panier"
            className="relative text-sm text-ink-muted transition-colors hover:text-ink"
          >
            Panier
            {cartCount > 0 ? (
              <span className="absolute -top-2 -right-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-deep">
                {cartCount}
              </span>
            ) : null}
          </Link>
          {user ? (
            <LinkButton href="/compte" variant="secondary" size="sm">
              Mon compte
            </LinkButton>
          ) : (
            <LinkButton href="/connexion" size="sm">
              Se connecter
            </LinkButton>
          )}
        </nav>
      </div>
    </header>
  );
}

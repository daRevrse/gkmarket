import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

/** En-tête public : logo, recherche globale, accès compte. */
export async function SiteHeader({ query }: { query?: string }) {
  const user = await getCurrentUser();

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

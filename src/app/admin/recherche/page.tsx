import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { searchSynonyms } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { pendingImageIndex } from "@/lib/image-index";
import { popularSearches, unmetSearches } from "@/lib/search";
import { ImageIndexRunner } from "./image-index";
import { SynonymManager } from "./synonym-manager";

/**
 * Recherche (docs/CHANGEMENTS.md §5, lot 4) : tendances et demandes non
 * servies des 30 derniers jours, synonymes locaux.
 */
export default async function AdminRecherchePage() {
  const [popular, unmet, groups, imageIndex] = await Promise.all([
    popularSearches(15, false),
    unmetSearches(15),
    db.select().from(searchSynonyms).orderBy(asc(searchSynonyms.createdAt)),
    pendingImageIndex(),
  ]);

  return (
    <main className="w-full flex-1">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-extrabold">Recherche</h1>
        <p className="mt-1 max-w-2xl text-ink-muted">
          Ce que les acheteurs cherchent (30 derniers jours) et les synonymes
          qui élargissent leurs recherches. Les recherches sans résultat sont
          des produits à recruter : elles sont aussi montrées aux vendeurs.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-bold">Recherches fréquentes</h2>
          {popular.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">Pas encore de recherche.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-white/[0.04] text-sm">
              {popular.map((row) => (
                <li key={row.query} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    href={`/produits?q=${encodeURIComponent(row.query)}`}
                    className="truncate hover:text-emerald"
                  >
                    {row.query}
                  </Link>
                  <span className="shrink-0 font-label text-xs text-ink-muted">
                    {`${row.count} fois · ${row.results} résultat${row.results > 1 ? "s" : ""}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold">Recherches sans résultat</h2>
          {unmet.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">
              Toutes les recherches ont trouvé des produits.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-white/[0.04] text-sm">
              {unmet.map((row) => (
                <li key={row.query} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">{row.query}</span>
                  <span className="shrink-0 font-label text-xs text-ink-muted">
                    {`${row.count} fois · dernière le ${row.lastAt?.toLocaleDateString("fr-FR") ?? "-"}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold">Recherche par image</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Chaque photo publiée reçoit une empreinte visuelle, calculée sur
          notre serveur, qui permet de retrouver un produit à partir d&apos;une
          photo. Les nouvelles fiches sont indexées automatiquement ; ce bouton
          sert au rattrapage du catalogue existant.
        </p>
        <p className="mt-3 text-sm">
          <span className="font-display text-xl font-bold text-gold">
            {imageIndex.indexed}
          </span>{" "}
          photo(s) indexée(s) ·{" "}
          <span className="font-display text-xl font-bold text-gold">
            {imageIndex.pending}
          </span>{" "}
          en attente
        </p>
        <ImageIndexRunner pending={imageIndex.pending} />
      </Card>

      <Card className="mt-6">
        <h2 className="font-display text-lg font-bold">Synonymes</h2>
        <p className="mt-1 mb-4 text-sm text-ink-muted">
          Les termes d&apos;un même groupe sont équivalents : chercher « wax »
          trouve aussi les produits « pagne ». Évitez les mots ambigus (par
          exemple « portable » : téléphone ou ordinateur).
        </p>
        <SynonymManager groups={groups.map((g) => ({ id: g.id, terms: g.terms }))} />
      </Card>
    </main>
  );
}

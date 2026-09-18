-- Recherche plein texte (docs/CHANGEMENTS.md §5, lot 4) : objets propres à
-- PostgreSQL, hors schéma Drizzle (colonne générée, index, fonction).

CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
-- pg_trgm : similarité de trigrammes pour corriger les fautes de frappe.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint

-- unaccent() n'est pas IMMUTABLE : cette enveloppe permet de l'utiliser dans
-- une colonne générée et dans des index.
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint

-- Vecteur de recherche français, sans accents : titre (poids A) puis
-- description (poids B).
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce("title", ''))), 'A') ||
  setweight(to_tsvector('french', public.immutable_unaccent(coalesce("description", ''))), 'B')
) STORED;--> statement-breakpoint
CREATE INDEX "products_search_idx" ON "products" USING gin ("search_vector");--> statement-breakpoint

-- Premiers synonymes locaux (modifiables dans l'admin).
INSERT INTO "search_synonyms" ("terms") VALUES
  (ARRAY['pagne', 'wax', 'tissu']),
  (ARRAY['telephone', 'smartphone', 'mobile']),
  (ARRAY['frigo', 'refrigerateur', 'congelateur']),
  (ARRAY['ordi', 'ordinateur', 'laptop', 'pc']),
  (ARRAY['tele', 'televiseur', 'television', 'tv']),
  (ARRAY['clim', 'climatiseur']),
  (ARRAY['gari', 'garri']);

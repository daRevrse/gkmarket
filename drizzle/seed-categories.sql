-- Catégories du catalogue GK Market (deux niveaux, adaptées au marché togolais).
-- Idempotent : relancer ne crée pas de doublons.
-- Exécution : psql -U gkmarket -h localhost -d gkmarket -f drizzle/seed-categories.sql

WITH parents (name, slug, position) AS (
  VALUES
    ('Électronique', 'electronique', 1),
    ('Mode & Vêtements', 'mode-vetements', 2),
    ('Maison & Cuisine', 'maison-cuisine', 3),
    ('Beauté & Santé', 'beaute-sante', 4),
    ('Alimentation', 'alimentation', 5),
    ('Bébés & Enfants', 'bebes-enfants', 6),
    ('Sport & Loisirs', 'sport-loisirs', 7),
    ('Auto & Moto', 'auto-moto', 8)
)
INSERT INTO categories (name, slug, position)
SELECT name, slug, position FROM parents
ON CONFLICT (slug) DO NOTHING;

WITH subs (parent_slug, name, slug, position) AS (
  VALUES
    ('electronique', 'Téléphones & Tablettes', 'telephones-tablettes', 1),
    ('electronique', 'Ordinateurs', 'ordinateurs', 2),
    ('electronique', 'TV & Audio', 'tv-audio', 3),
    ('electronique', 'Accessoires électroniques', 'accessoires-electroniques', 4),
    ('mode-vetements', 'Vêtements femme', 'vetements-femme', 1),
    ('mode-vetements', 'Vêtements homme', 'vetements-homme', 2),
    ('mode-vetements', 'Chaussures', 'chaussures', 3),
    ('mode-vetements', 'Sacs & Accessoires', 'sacs-accessoires', 4),
    ('mode-vetements', 'Tissus & Pagnes', 'tissus-pagnes', 5),
    ('maison-cuisine', 'Meubles', 'meubles', 1),
    ('maison-cuisine', 'Électroménager', 'electromenager', 2),
    ('maison-cuisine', 'Décoration', 'decoration', 3),
    ('maison-cuisine', 'Ustensiles de cuisine', 'ustensiles-cuisine', 4),
    ('beaute-sante', 'Cosmétiques', 'cosmetiques', 1),
    ('beaute-sante', 'Soins capillaires', 'soins-capillaires', 2),
    ('beaute-sante', 'Parfums', 'parfums', 3),
    ('beaute-sante', 'Hygiène', 'hygiene', 4),
    ('alimentation', 'Épicerie', 'epicerie', 1),
    ('alimentation', 'Boissons', 'boissons', 2),
    ('alimentation', 'Céréales & Légumineuses', 'cereales-legumineuses', 3),
    ('alimentation', 'Produits frais', 'produits-frais', 4),
    ('bebes-enfants', 'Vêtements enfants', 'vetements-enfants', 1),
    ('bebes-enfants', 'Jouets', 'jouets', 2),
    ('bebes-enfants', 'Puériculture', 'puericulture', 3),
    ('sport-loisirs', 'Équipement sportif', 'equipement-sportif', 1),
    ('sport-loisirs', 'Livres & Papeterie', 'livres-papeterie', 2),
    ('sport-loisirs', 'Jeux', 'jeux', 3),
    ('auto-moto', 'Pièces auto', 'pieces-auto', 1),
    ('auto-moto', 'Accessoires moto', 'accessoires-moto', 2),
    ('auto-moto', 'Pneus & Batteries', 'pneus-batteries', 3)
)
INSERT INTO categories (name, slug, parent_id, position)
SELECT s.name, s.slug, c.id, s.position
FROM subs s
JOIN categories c ON c.slug = s.parent_slug
ON CONFLICT (slug) DO NOTHING;

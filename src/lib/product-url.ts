// URLs produit optimisées SEO (MVP n°289) : /produits/<slug-du-titre>-<uuid>.
// L'UUID en fin de chemin reste la seule clé : les anciens liens /produits/<uuid>
// fonctionnent toujours et un slug modifié redirige vers l'URL canonique.

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function productSlug(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** Chemin canonique d'une fiche produit. */
export function productPath(product: { id: string; title: string }): string {
  const slug = productSlug(product.title);
  return slug ? `/produits/${slug}-${product.id}` : `/produits/${product.id}`;
}

/** Extrait l'UUID du paramètre d'URL (slug optionnel devant). */
export function productIdFromParam(param: string): string | null {
  const match = decodeURIComponent(param).match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

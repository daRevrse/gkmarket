// Tarification B2B/B2C : promo temporaire et prix de gros.
// Le prix de gros s'applique automatiquement dès que la quantité atteint le
// palier du vendeur ; une promo active remplace le prix de base. On ne facture
// jamais plus cher que le meilleur des deux.

export type PricedProduct = {
  priceFcfa: number;
  wholesalePriceFcfa: number | null;
  wholesaleMinQty: number | null;
  promoPriceFcfa?: number | null;
  // Date côté serveur, chaîne ISO une fois sérialisée vers le client.
  promoEndsAt?: Date | string | null;
};

export function isPromoActive(
  product: PricedProduct,
  now: Date = new Date(),
): boolean {
  return (
    product.promoPriceFcfa != null &&
    product.promoEndsAt != null &&
    product.promoPriceFcfa < product.priceFcfa &&
    new Date(product.promoEndsAt) > now
  );
}

/** Prix unitaire de base (promo appliquée si active), hors palier de gros. */
export function basePriceFcfa(
  product: PricedProduct,
  now: Date = new Date(),
): number {
  return isPromoActive(product, now)
    ? product.promoPriceFcfa!
    : product.priceFcfa;
}

export function unitPriceFcfa(
  product: PricedProduct,
  quantity: number,
  now: Date = new Date(),
): number {
  const base = basePriceFcfa(product, now);
  if (
    product.wholesalePriceFcfa != null &&
    product.wholesaleMinQty != null &&
    quantity >= product.wholesaleMinQty
  ) {
    return Math.min(base, product.wholesalePriceFcfa);
  }
  return base;
}

export function isWholesaleApplied(
  product: PricedProduct,
  quantity: number,
  now: Date = new Date(),
): boolean {
  return (
    product.wholesalePriceFcfa != null &&
    product.wholesaleMinQty != null &&
    quantity >= product.wholesaleMinQty &&
    product.wholesalePriceFcfa < basePriceFcfa(product, now)
  );
}

// Frais de livraison provisoires du MVP : forfait par vendeur, Lomé uniquement.
// Remplacés par le vrai calcul au module Livraison.
export const DELIVERY_FEE_PER_SELLER_FCFA = 1000;

// Commission plateforme (MVP n°114), prélevée sur le sous-total marchand
// au versement vendeur. Les frais de livraison restent à la plateforme
// (ils financeront les livreurs au module Livraison).
export const PLATFORM_COMMISSION_RATE = 0.05;

export function commissionFcfa(subtotalFcfa: number): number {
  return Math.round(subtotalFcfa * PLATFORM_COMMISSION_RATE);
}

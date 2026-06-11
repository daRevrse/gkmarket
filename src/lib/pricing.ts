// Tarification B2B/B2C : le prix de gros s'applique automatiquement
// dès que la quantité atteint le palier défini par le vendeur.

export type PricedProduct = {
  priceFcfa: number;
  wholesalePriceFcfa: number | null;
  wholesaleMinQty: number | null;
};

export function unitPriceFcfa(product: PricedProduct, quantity: number): number {
  if (
    product.wholesalePriceFcfa != null &&
    product.wholesaleMinQty != null &&
    quantity >= product.wholesaleMinQty
  ) {
    return product.wholesalePriceFcfa;
  }
  return product.priceFcfa;
}

export function isWholesaleApplied(
  product: PricedProduct,
  quantity: number,
): boolean {
  return unitPriceFcfa(product, quantity) !== product.priceFcfa;
}

// Frais de livraison provisoires du MVP : forfait par vendeur, Lomé uniquement.
// Remplacés par le vrai calcul au module Livraison.
export const DELIVERY_FEE_PER_SELLER_FCFA = 1000;

/** Prix en FCFA (XOF) : entiers, séparateur de milliers français. */
export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

/** Taux en pourcentage, format français (1,5 %). */
export function formatPct(pct: number): string {
  return `${pct.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

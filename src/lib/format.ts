/** Prix en FCFA (XOF) : entiers, séparateur de milliers français. */
export function formatFcfa(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}

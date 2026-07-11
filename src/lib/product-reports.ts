// Motifs de signalement produit (MVP n°275), partagés entre le formulaire
// public, l'action serveur et le back-office admin.
export const productReportReasonLabels: Record<string, string> = {
  counterfeit: "Contrefaçon",
  forbidden: "Produit interdit ou dangereux",
  misleading: "Annonce trompeuse",
  other: "Autre problème",
};

export const productReportStatusLabels: Record<string, string> = {
  open: "À examiner",
  resolved: "Produit retiré",
  dismissed: "Classé sans suite",
};

import type { Metadata } from "next";
import { LegalSection, LegalTitle } from "@/components/legal";

export const metadata: Metadata = {
  title: "Conditions de vente - Deal Lomé",
  description:
    "Conditions générales de vente : commande, paiement sécurisé, livraison, retours et litiges sur Deal Lomé.",
};

export default function CgvPage() {
  return (
    <>
      <LegalTitle updated="10 juillet 2026">
        Conditions générales de vente
      </LegalTitle>

      <LegalSection title="1. Rôle de la plateforme">
        <p>
          Deal Lomé est une place de marché : le contrat de vente est conclu
          directement entre l&apos;acheteur et le vendeur. Deal Lomé fournit
          l&apos;infrastructure de mise en relation, de paiement sécurisé et de
          suivi.
        </p>
      </LegalSection>

      <LegalSection title="2. Prix">
        <p>
          Les prix sont affichés en francs CFA (XOF), toutes taxes comprises le
          cas échéant. Les frais de livraison sont indiqués au panier avant la
          validation de la commande.
        </p>
      </LegalSection>

      <LegalSection title="3. Commande et paiement sécurisé">
        <p>
          Au paiement, les fonds de l&apos;acheteur sont <strong>sécurisés</strong>{" "}
          par la plateforme et ne sont versés au vendeur qu&apos;après
          confirmation de la réception (ou automatiquement après un délai sans
          litige). Ce mécanisme protège l&apos;acheteur comme le vendeur.
        </p>
      </LegalSection>

      <LegalSection title="4. Livraison">
        <p>
          La livraison est assurée par le vendeur ou par un livreur partenaire.
          Les délais et frais dépendent du vendeur et de la zone de livraison.
          L&apos;acheteur confirme la réception pour libérer le paiement.
        </p>
      </LegalSection>

      <LegalSection title="5. Retours et remboursements">
        <p>
          En cas de produit non conforme, endommagé ou non reçu,
          l&apos;acheteur peut ouvrir un litige depuis le détail de sa commande,
          tant que les fonds sont encore sécurisés. Un remboursement total ou
          partiel peut être décidé après arbitrage.
        </p>
      </LegalSection>

      <LegalSection title="6. Litiges">
        <p>
          Les litiges suivent une procédure en plusieurs phases : dialogue entre
          les parties, médiation puis décision de Deal Lomé. Pendant toute la
          durée du litige, les fonds restent bloqués.
        </p>
      </LegalSection>

      <LegalSection title="7. Commission">
        <p>
          Deal Lomé prélève une commission de service (5 %) sur chaque vente
          aboutie, déduite du versement au vendeur. La création de boutique est
          gratuite.
        </p>
      </LegalSection>

      <LegalSection title="8. Droit applicable">
        <p>
          Les présentes conditions sont régies par le droit togolais. Tout
          litige non résolu à l&apos;amiable relève des juridictions de Lomé.
        </p>
      </LegalSection>
    </>
  );
}

import type { Metadata } from "next";
import { LegalSection, LegalTitle } from "@/components/legal";

export const metadata: Metadata = {
  title: "Conditions d'utilisation - Deal Lomé",
  description:
    "Conditions générales d'utilisation de la marketplace Deal Lomé (compte, obligations, données, cookies).",
};

export default function CguPage() {
  return (
    <>
      <LegalTitle updated="10 juillet 2026">
        Conditions générales d&apos;utilisation
      </LegalTitle>

      <LegalSection title="1. Objet">
        <p>
          Les présentes conditions régissent l&apos;accès et l&apos;utilisation
          de la plateforme Deal Lomé. En créant un compte ou en utilisant le
          site, vous les acceptez sans réserve.
        </p>
      </LegalSection>

      <LegalSection title="2. Compte utilisateur">
        <p>
          L&apos;inscription se fait par email ou numéro de téléphone. Vous êtes
          responsable de la confidentialité de vos identifiants et de toute
          activité réalisée depuis votre compte. Les informations fournies
          doivent être exactes et à jour.
        </p>
      </LegalSection>

      <LegalSection title="3. Rôles">
        <p>
          Un même compte peut être acheteur, vendeur et/ou livreur. Les vendeurs
          et livreurs font l&apos;objet d&apos;une validation (vérification
          d&apos;identité) avant activation.
        </p>
      </LegalSection>

      <LegalSection title="4. Obligations">
        <p>
          Vous vous engagez à ne pas publier de contenu illicite, trompeur ou
          contrefait, à ne pas contourner le système de paiement sécurisé de la
          plateforme, et à respecter les lois en vigueur au Togo.
        </p>
      </LegalSection>

      <LegalSection title="5. Données personnelles">
        <p>
          Nous collectons les données nécessaires au fonctionnement du service
          (compte, commandes, livraison). Les documents d&apos;identité
          (vérification vendeur/livreur) sont conservés de manière privée et
          consultés uniquement à des fins de validation. Vous pouvez demander
          l&apos;accès, la rectification ou la suppression de vos données via le
          formulaire de contact.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <p>
          Deal Lomé n&apos;utilise que des cookies essentiels au fonctionnement
          du site : cookie de session (connexion) et cookie de panier pour les
          visiteurs non connectés. Aucun traceur publicitaire n&apos;est déposé.
        </p>
      </LegalSection>

      <LegalSection title="7. Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis votre espace.
          Deal Lomé peut suspendre un compte en cas de manquement aux présentes
          conditions.
        </p>
      </LegalSection>

      <LegalSection title="8. Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit togolais. Tout litige
          relève des juridictions compétentes de Lomé.
        </p>
      </LegalSection>
    </>
  );
}

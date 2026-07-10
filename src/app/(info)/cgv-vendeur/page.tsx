import type { Metadata } from "next";
import Link from "next/link";
import { LegalSection, LegalTitle } from "@/components/legal";

export const metadata: Metadata = {
  title: "Conditions vendeur - Deal Lomé",
  description:
    "Conditions applicables aux vendeurs de Deal Lomé : ouverture de boutique, obligations, paiement sécurisé, versement des gains et commission.",
};

export default function CgvVendeurPage() {
  return (
    <>
      <LegalTitle updated="10 juillet 2026">
        Conditions vendeur
      </LegalTitle>

      <LegalSection title="1. Ouverture de boutique">
        <p>
          Pour vendre sur Deal Lomé, vous créez une boutique et transmettez une
          pièce d&apos;identité (et, le cas échéant, votre RCCM et un
          justificatif d&apos;adresse). Votre boutique n&apos;est visible
          qu&apos;après validation de ces documents par notre équipe.
        </p>
      </LegalSection>

      <LegalSection title="2. Vos engagements">
        <p>
          Vous garantissez que vos produits sont licites, conformes à leur
          description, en stock, et que vous êtes en droit de les vendre. Les
          contrefaçons, produits interdits ou dangereux sont proscrits et
          entraînent la suspension immédiate de la boutique.
        </p>
      </LegalSection>

      <LegalSection title="3. Traitement des commandes">
        <p>
          Vous acceptez ou refusez chaque commande avec un motif, la préparez
          dans les délais annoncés, puis l&apos;expédiez vous-même ou via un
          livreur partenaire. Un refus après paiement rembourse intégralement
          l&apos;acheteur.
        </p>
      </LegalSection>

      <LegalSection title="4. Paiement sécurisé et versement">
        <p>
          Les fonds de l&apos;acheteur sont sécurisés par la plateforme dès le
          paiement et ne vous sont versés qu&apos;après confirmation de la
          réception (ou automatiquement après le délai sans litige). Le
          versement est effectué sur les coordonnées (Mobile Money ou compte
          bancaire) renseignées dans votre profil.
        </p>
      </LegalSection>

      <LegalSection title="5. Commission">
        <p>
          Deal Lomé prélève une commission de service de 5 % sur chaque vente
          aboutie, déduite de votre versement. La création et la gestion de la
          boutique sont gratuites.
        </p>
      </LegalSection>

      <LegalSection title="6. Conditions de vente de la boutique">
        <p>
          Vous pouvez publier vos propres conditions de vente (délais de
          préparation, retours, garanties). Elles complètent — sans y déroger —
          les{" "}
          <Link href="/cgv" className="text-emerald hover:underline">
            conditions générales de vente
          </Link>{" "}
          de la plateforme.
        </p>
      </LegalSection>

      <LegalSection title="7. Suspension">
        <p>
          En cas de manquement (produits non conformes, litiges répétés, fraude),
          Deal Lomé peut suspendre ou fermer votre boutique. Les commandes en
          cours et les litiges ouverts restent traités jusqu&apos;à leur
          résolution.
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

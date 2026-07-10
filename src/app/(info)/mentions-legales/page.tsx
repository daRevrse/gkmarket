import type { Metadata } from "next";
import { LegalSection, LegalTitle } from "@/components/legal";

export const metadata: Metadata = {
  title: "Mentions légales - Deal Lomé",
  description: "Éditeur, hébergement et informations légales de Deal Lomé.",
};

export default function MentionsLegalesPage() {
  return (
    <>
      <LegalTitle updated="10 juillet 2026">Mentions légales</LegalTitle>

      <LegalSection title="Éditeur du site">
        <p>
          Le site <strong>deallome.com</strong> (« Deal Lomé ») est édité par{" "}
          <strong>GK NÉGOCES</strong>, entreprise établie à Lomé, Togo.
        </p>
        <p>
          Contact : <a href="mailto:support@deallome.com" className="text-emerald hover:underline">support@deallome.com</a>{" "}
          — via le <a href="/contact" className="text-emerald hover:underline">formulaire de contact</a>.
        </p>
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>
          Le représentant légal de GK NÉGOCES assure la direction de la
          publication.
        </p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Le site est hébergé sur un serveur dédié situé en Union européenne
          (Contabo GmbH). Les services d&apos;authentification et de stockage de
          fichiers sont fournis par Google Firebase.
        </p>
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          La marque, le logo, la charte graphique et les contenus produits par
          Deal Lomé sont protégés. Les fiches et visuels des produits restent la
          propriété des vendeurs qui les publient. Toute reproduction non
          autorisée est interdite.
        </p>
      </LegalSection>

      <LegalSection title="Responsabilité">
        <p>
          Deal Lomé est une place de marché mettant en relation acheteurs et
          vendeurs indépendants. Les produits sont vendus sous la responsabilité
          de leurs vendeurs. Voir nos{" "}
          <a href="/cgv" className="text-emerald hover:underline">
            conditions générales de vente
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { LegalTitle } from "@/components/legal";

export const metadata: Metadata = {
  title: "Aide & FAQ - Deal Lomé",
  description:
    "Questions fréquentes : commander, payer en toute sécurité, suivre sa livraison, ouvrir un litige, vendre ou livrer sur Deal Lomé.",
};

type Faq = { q: string; a: React.ReactNode };

function FaqSection({ title, items }: { title: string; items: Faq[] }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-lg font-bold">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-md border border-white/[0.08] bg-white/[0.03] open:border-emerald/30"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden group-open:text-emerald">
              {item.q}
            </summary>
            <div className="space-y-2 px-4 pb-4 text-sm leading-relaxed text-ink-muted">
              {item.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function FaqPage() {
  return (
    <>
      <LegalTitle>Aide & questions fréquentes</LegalTitle>

      <FaqSection
        title="Commander et payer"
        items={[
          {
            q: "Dois-je créer un compte pour acheter ?",
            a: (
              <p>
                Non pour parcourir et remplir votre panier - un compte n&apos;est
                demandé qu&apos;au moment de payer, pour sécuriser la commande et
                vous permettre de la suivre.
              </p>
            ),
          },
          {
            q: "Comment fonctionne le paiement sécurisé ?",
            a: (
              <p>
                Au paiement, vos fonds sont bloqués par la plateforme et ne sont
                versés au vendeur qu&apos;après confirmation de la réception. En
                cas de problème, vous ouvrez un litige et les fonds restent
                bloqués jusqu&apos;à la résolution.
              </p>
            ),
          },
          {
            q: "Comment recharger mon wallet ?",
            a: (
              <p>
                Depuis <Link href="/compte/wallet" className="text-emerald hover:underline">Mon wallet</Link>,
                par Mobile Money (Flooz, T-Money). Le solde sert à payer vos
                commandes ; les remboursements y sont recrédités immédiatement.
              </p>
            ),
          },
          {
            q: "Puis-je annuler une commande ?",
            a: (
              <p>
                Oui, tant qu&apos;elle n&apos;est pas expédiée, depuis le détail
                de la commande. Si elle était payée, vous êtes intégralement
                remboursé sur votre wallet et le stock est restitué au vendeur.
              </p>
            ),
          },
          {
            q: "Où trouver ma facture ?",
            a: (
              <p>
                Elle est jointe en PDF à l&apos;email de confirmation de paiement
                et reste téléchargeable à tout moment depuis le détail de la
                commande.
              </p>
            ),
          },
        ]}
      />

      <FaqSection
        title="Livraison"
        items={[
          {
            q: "Quels sont les délais et frais de livraison ?",
            a: (
              <p>
                La livraison couvre Lomé et ses environs (MVP). Les frais sont
                affichés au panier avant validation, par vendeur. Le délai dépend
                du temps de préparation indiqué sur chaque fiche produit.
              </p>
            ),
          },
          {
            q: "Comment suivre ma commande ?",
            a: (
              <p>
                Chaque étape (acceptation, expédition, n° de suivi, livraison)
                est visible dans{" "}
                <Link href="/compte/commandes" className="text-emerald hover:underline">
                  Mes commandes
                </Link>{" "}
                et notifiée par email.
              </p>
            ),
          },
          {
            q: "Que faire à la réception du colis ?",
            a: (
              <p>
                Vérifiez le contenu puis confirmez la réception depuis le détail
                de la commande : c&apos;est cette confirmation qui libère le
                paiement au vendeur. Sans action de votre part, la libération est
                automatique après un délai de protection.
              </p>
            ),
          },
        ]}
      />

      <FaqSection
        title="Retours et litiges"
        items={[
          {
            q: "Produit non conforme, endommagé ou non reçu : que faire ?",
            a: (
              <p>
                Ouvrez un litige depuis le détail de la commande tant que les
                fonds sont bloqués. Dialogue avec le vendeur, médiation puis
                décision Deal Lomé : remboursement total, partiel, ou versement
                au vendeur.
              </p>
            ),
          },
          {
            q: "Comment signaler un produit suspect ?",
            a: (
              <p>
                Chaque fiche produit propose « Signaler ce produit »
                (contrefaçon, produit interdit, annonce trompeuse). Notre équipe
                examine chaque signalement et retire les produits non conformes.
              </p>
            ),
          },
        ]}
      />

      <FaqSection
        title="Vendre sur Deal Lomé"
        items={[
          {
            q: "Comment ouvrir ma boutique ?",
            a: (
              <p>
                Depuis{" "}
                <Link href="/compte/devenir-vendeur" className="text-emerald hover:underline">
                  Devenir vendeur
                </Link>{" "}
                : nom de boutique, pièce d&apos;identité (RCCM et justificatif
                d&apos;adresse facultatifs) et acceptation des{" "}
                <Link href="/cgv-vendeur" className="text-emerald hover:underline">
                  conditions vendeur
                </Link>
                . Votre boutique est active après validation, généralement sous
                48 h.
              </p>
            ),
          },
          {
            q: "Combien ça coûte ?",
            a: (
              <p>
                L&apos;ouverture et la gestion de la boutique sont gratuites. Une
                commission de service est prélevée uniquement sur les ventes
                abouties, au moment du versement.
              </p>
            ),
          },
          {
            q: "Quand suis-je payé ?",
            a: (
              <p>
                Dès que l&apos;acheteur confirme la réception (ou automatiquement
                après le délai sans litige), le montant net est versé sur votre
                wallet. Renseignez vos coordonnées Mobile Money ou bancaires dans
                votre profil pour les retraits.
              </p>
            ),
          },
          {
            q: "Comment créer une promotion ?",
            a: (
              <p>
                Sur la fiche de votre produit, définissez un prix promo et une
                date de fin : le prix barré, le badge de remise et le compte à
                rebours s&apos;affichent automatiquement.
              </p>
            ),
          },
        ]}
      />

      <FaqSection
        title="Livrer pour Deal Lomé"
        items={[
          {
            q: "Comment devenir livreur partenaire ?",
            a: (
              <p>
                Candidatez depuis{" "}
                <Link href="/compte/devenir-livreur" className="text-emerald hover:underline">
                  Devenir livreur
                </Link>{" "}
                avec votre pièce d&apos;identité, votre véhicule et votre zone.
                Après validation, les vendeurs vous proposent des courses que
                vous êtes libre d&apos;accepter.
              </p>
            ),
          },
          {
            q: "Comment sont payées les courses ?",
            a: (
              <p>
                Les frais de livraison de la commande vous sont versés sur votre
                wallet dès la confirmation de réception par l&apos;acheteur, avec
                preuve de remise (photo, nom du destinataire).
              </p>
            ),
          },
        ]}
      />

      <FaqSection
        title="Compte et sécurité"
        items={[
          {
            q: "Comment modifier mes informations ?",
            a: (
              <p>
                Nom, boutique, logo, conditions de vente et coordonnées de
                versement se modifient dans{" "}
                <Link href="/compte/profil" className="text-emerald hover:underline">
                  Mon profil
                </Link>
                . L&apos;email et le téléphone servent à la connexion et ne se
                changent pas librement - contactez le support.
              </p>
            ),
          },
          {
            q: "Comment supprimer mon compte ?",
            a: (
              <p>
                En bas de{" "}
                <Link href="/compte/profil" className="text-emerald hover:underline">
                  Mon profil
                </Link>
                . Vos données personnelles sont anonymisées ; l&apos;historique
                des transactions est conservé pour les obligations légales.
              </p>
            ),
          },
        ]}
      />

      <p className="mt-2 text-sm text-ink-muted">
        Vous n&apos;avez pas trouvé votre réponse ?{" "}
        <Link href="/contact" className="text-emerald hover:underline">
          Contactez-nous
        </Link>{" "}
        - nous répondons rapidement.
      </p>
    </>
  );
}

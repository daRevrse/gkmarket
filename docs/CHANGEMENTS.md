# Changements par rapport aux documents initiaux

Ce document consigne les changements décidés par rapport au cahier des charges
(`CAHIER DES CHARGES PLATEFORME.pdf`) et à l'explosion des fonctionnalités
(`Explosion du projet.xlsx`). Il fait foi en cas de divergence avec ces documents.

---

## 1. Le livreur devient un compte à part entière (2026-06-10)

**Avant (documents initiaux) :**
- Le « Livreur » est cité comme type d'utilisateur dans le cahier des charges, mais sans aucun module dédié.
- La livraison MVP repose sur des **agences partenaires** (Excel MVP n°167-169 : liste agences, sélection agence par vendeur, calcul tarifs par agence) ; la Phase 2 ajoute l'API d'intégration agence, la génération de bordereaux et le tracking automatique.
- Le livreur n'apparaît que comme métadonnée des preuves de livraison (nom, photo, signature).

**Après (changement décidé) :**
- Le **livreur est un compte à part entière** dès le MVP : inscription, vérification, profil, dashboard.
- Les **vendeurs font appel aux livreurs** pour effectuer les livraisons (demande / attribution de course par commande).
- Le livreur gère ses courses : acceptation, mise à jour des statuts de livraison, upload des preuves (photo, signature, date/heure).
- La **livraison via agence de livraison est reportée à une phase ultérieure** (les items agences sortent du MVP).

**Impact sur les modules :**
- Module 1 (Utilisateurs) : ajout inscription/connexion/profil livreur.
- Nouveau périmètre : dashboard livreur, gestion des courses, gains/rémunération livreur.
- Module 8 (Livraison) : items « Agences » (MVP n°167-169) et automatisations agence de Phase 2 → reportés.

---

## 2. Modèle multi-rôles : un compte, plusieurs casquettes (2026-06-11)

**Décision :** un utilisateur peut cumuler les rôles. Tout compte est **acheteur par défaut** ;
« vendeur » et « livreur » sont des **casquettes supplémentaires** activées après vérification (KYC).
Modèle Alibaba/Amazon : un seul compte, plusieurs capacités.

**Implémentation :** table `users` (identité, lien Firebase) + tables `seller_profiles` et
`courier_profiles` (l'existence d'un profil = la casquette ; son `status` = l'état de vérification).
L'admin est un booléen `is_admin` sur `users`.

---

## 3. Suivi d'avancement dans l'explosion du projet (2026-06-11)

**Convention :** `docs/Explosion du projet.xlsx` reste la référence **intacte** (spec d'origine).
Le suivi d'avancement se fait dans **`docs/Explosion du projet - MAJ.xlsx`**, à mettre à jour
**à la fin de chaque itération** :
- colonne *Statut* : `✅ Réalisé` (fond vert) ou `🟡 Partiel` (fond orange) ;
- colonne *Commentaire* : n° d'itération + précisions ;
- l'onglet *Récapitulatif* compte les réalisations automatiquement (formules `COUNTIF`).

**Précisions (2026-06-10) :**

---

## 4. Nom de la plateforme : « Deal Lomé », domaine deallome.com (2026-06-12)

**Décision :** la plateforme s'appelle **Deal Lomé** (et non plus « GK Market »).
Le domaine **deallome.com** sera acheté **chez Vercel** (DNS géré dans le
dashboard Vercel).

**Impact :**
- Marque renommée dans toute l'interface, les emails transactionnels et les
  métadonnées SEO. Les nouveaux numéros de commande sont préfixés `DL-`
  (les anciens `GK-` des données de test restent valides).
- **Emails** : Vercel n'héberge pas de boîtes mail —
  - *envoi* (Brevo) : authentifier `deallome.com` (SPF/DKIM/DMARC dans le
    DNS Vercel) ; `no-reply@deallome.com` envoie sans boîte mail réelle ;
  - *réception* (`support@`, `contact@`) : redirection gratuite
    (ImprovMX / Cloudflare Email Routing) vers une boîte existante pour le
    MVP ; Zoho Mail (gratuit ≤ 5 comptes) si de vraies boîtes deviennent
    nécessaires.
- Les identifiants techniques internes (dépôt `gkmarket`, base PostgreSQL,
  projet émulateur Firebase `demo-gkmarket`, comptes de test
  `*@gkmarket.tg`) restent inchangés en local — ils seront renommés à la
  mise en production si souhaité.
- **Attribution des courses :** une **proposition intelligente de livreurs** est faite au vendeur (matching automatique — critères à définir : proximité, disponibilité, note, historique). Le vendeur choisit parmi les livreurs proposés.
- **Paiement du livreur :** le livreur est **payé par le vendeur**, via le **Wallet** et le **système Escrow** (mêmes mécanismes que le reste de la plateforme). Le livreur dispose donc d'un Wallet livreur.
- **Refus de course :** le livreur **peut refuser une course**. Le flux doit prévoir la re-proposition à un autre livreur.
- **Responsabilité en cas d'incident** (colis perdu/endommagé, vendeur vs livreur) : **en cours d'analyse** — à trancher avant l'implémentation du module litiges/livraison.

---

## 5. Flux acheteur-vendeur : retours des testeurs et propriétaires (2026-09-18)

Retours recueillis auprès des testeurs et des propriétaires, inspirés du
parcours Alibaba (discuter depuis un article, bon de commande dans le chat,
profil fournisseur détaillé). Ils avancent plusieurs items de Phase 2/3 de
l'explosion du projet (favoris, devis B2B, pièces jointes, recherche par
image, appels).

**Découpage en lots (ordre de réalisation) :**

1. **Chat v2** : messages typés (texte, fiche produit, photo, document,
   vocal, bon de commande, système), carte produit envoyée depuis un article,
   temps réel, pièces jointes, messages vocaux, notifications, blocage du
   contournement.
2. **Boutons produit** : Acheter maintenant (achat direct, hors panier),
   Ajouter au panier, Discuter, Ma liste ; « Vus récemment ».
3. **Bon de commande et paiement dans le chat**, frais de service.
4. **Recherche** : plein texte français, accents/fautes, synonymes,
   autocomplétion.
5. **Profil vendeur** (onglets, indicateurs calculés) et système d'avis.
6. **Médias** : vidéo produit, téléchargement des médias.
7. **Recherche par image**, puis **appels audio/vidéo**.

**Décisions des propriétaires :**

- **Frais plateforme** : l'acheteur paie des **frais de service de 1 %** plus
  les **frais de paiement Mobile Money** (répercutés). La commission vendeur
  existante (paramétrable, 5 % par défaut) est conservée. **Ces frais ne sont
  pas remboursés** en cas d'annulation ou de remboursement (seuls le
  sous-total et la livraison le sont).
- **Paiement réel** : pas encore de compte marchand FedaPay, la plateforme
  reste en **mode démo** (wallet et Mobile Money simulés). Le paiement dans le
  chat est développé sur ce mode et branché sur FedaPay plus tard.
- **Bon de commande** : l'acheteur **peut demander un devis** ; le vendeur
  émet le bon, **fixe sa durée de validité** et **fixe librement les prix**.
  Le bon accepté devient une commande normale (paiement sécurisé, livraison,
  litige, facture).
- **Liste** : **une seule liste** par acheteur (« Ma liste »).
- **Téléchargement des médias** : réservé aux **comptes connectés**, avec
  **filigrane Deal Lomé**.
- **Contournement** (numéros, emails, liens WhatsApp/Telegram… dans les
  échanges) : le message est **bloqué**, l'expéditeur reçoit un
  **avertissement** et est placé **en surveillance côté admin**.
- **Appels audio/vidéo et recherche par image** : **auto-hébergés sur le VPS**
  (pas de service tiers payant).
- **Avis** : uniquement après **livraison** (mention « Achat vérifié »), non
  modifiables ; une réponse du vendeur par avis ; masquage par la modération
  (l'avis sort des moyennes sans être supprimé) ; affichage public
  anonymisé (prénom + initiale). Les **indicateurs de la boutique** sont
  calculés par la plateforme, jamais déclarés par le vendeur, et masqués
  sous 5 commandes livrées (badge « Nouveau vendeur »).

**Avancement :** lots 1 à 4 livrés en production le 2026-09-21 ; lot 5
(profil vendeur détaillé et avis) développé le 2026-09-21.

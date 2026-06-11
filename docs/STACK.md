# Stack technique — décisions

Dernière mise à jour : 2026-06-10. Ce document consigne les choix techniques actés
pour le MVP et les points encore ouverts.

## Décisions actées

| Composant | Choix | Notes |
|---|---|---|
| Frontend + API | Next.js (App Router) + TypeScript + Tailwind CSS | SSR requis pour le SEO produit (MVP n°289-291) |
| Authentification | Firebase Authentication (email + OTP téléphone) | ⚠️ Depuis sept. 2024 : plan Blaze requis, SMS facturés (~0,05-0,06 $/SMS pour l'Afrique). Budgéter les SMS + configurer des alertes de budget GCP. |
| Notifications push | Firebase Cloud Messaging (FCM) | Gratuit. Push app = Phase 3 ; in-app = Phase 2. |
| Base de données métier | **PostgreSQL sur VPS Contabo** (Docker) | Source de vérité unique : produits, commandes, wallet, escrow, litiges, commissions. Transactions ACID pour le ledger financier, SQL pour recherche et reporting. |
| VPS | **Contabo** (région Europe) | Héberge PostgreSQL + logique Escrow/API. Sauvegardes Contabo limitées → stratégie backup dédiée obligatoire (voir plus bas). |
| Paiement | FedaPay API | Flooz, TMoney, cartes. Frais 1-2,5 %/transaction. Sandbox en staging, clés réelles en prod. |
| Emails transactionnels | Brevo (plan gratuit, 300 emails/jour) | Suffisant pour le MVP. |
| Domaine | OVH (.com / .tg) | ~10 €/an. |
| Versionnement / CI | Git + GitHub (+ GitHub Actions) | Branches de fonctionnalité + PR ; CI : lint, tests, migrations. |

## Points en attente de décision

| Sujet | Options | Recommandation |
|---|---|---|
| Hébergement frontend | Vercel Pro (~20 $/mois, previews auto, zéro ops) vs auto-hébergement sur le VPS Contabo (0 €, previews manuelles) | Démarrer sur Vercel (gratuit en développement, previews pour les démos), trancher au lancement commercial. Next.js est portable : bascule possible sans réécriture. Firebase Hosting/App Hosting écarté (statique seulement / immature). |
| Chat temps réel (messagerie MVP) | Firestore vs Postgres + WebSockets/SSE | À trancher au moment du module Communication. |
| Responsabilité incidents livraison | Vendeur vs livreur | En cours d'analyse côté métier (voir CHANGEMENTS.md §1). |

## Abandonné

- **Firestore comme base de données principale** : inadapté à une marketplace avec escrow
  (pas de transactions financières fiables multi-collections, recherche/filtres produits faibles,
  reporting admin laborieux). Remplacé par PostgreSQL. Le tableau « Stack Firebase Hybride »
  initial reposait aussi sur des gratuités Spark périmées (SMS et Cloud Functions exigent Blaze
  depuis sept. 2024).
- **Hetzner** : remplacé par Contabo (décision du 2026-06-10).
- **Supabase** : proposé comme alternative zéro-ops, non retenu au profit du VPS auto-géré.

## Authentification téléphone (conception)

Le cahier des charges demande la « connexion téléphone/mot de passe » (MVP n°4) et la
« vérification téléphone OTP » (MVP n°7). Implémentation retenue pour minimiser les coûts SMS :

- **Inscription** : OTP SMS envoyé une seule fois pour vérifier le numéro (Firebase Phone Auth),
  puis un identifiant interne dérivé du numéro (`22890123456@tel.gkmarket.app`) est lié au compte
  avec le mot de passe choisi.
- **Connexion** : téléphone + mot de passe via cet identifiant interne — **aucun SMS**.
- Coût : **1 SMS par compte créé** (au lieu d'un SMS à chaque connexion).
- L'identifiant interne n'est jamais montré à l'utilisateur ni stocké comme email en base
  (filtré dans la route session). Normalisation des numéros togolais en E.164 dans `src/lib/phone.ts`.
- En local, l'émulateur Firebase Auth simule les SMS (codes visibles sur
  `http://127.0.0.1:9099/emulator/v1/projects/demo-gkmarket/verificationCodes`).
- **Mot de passe oublié par SMS** : OTP de vérification, puis `updatePassword`.
  Attention, Firebase révoque les jetons après un changement de mot de passe :
  le formulaire se reconnecte aussitôt avec le nouveau mot de passe.
- **Connexion Google** : `signInWithPopup` ; l'émulateur affiche un faux
  sélecteur de compte (aucune configuration Google requise en local).

## Suppression de compte (conception)

Archivage intelligent plutôt qu'effacement total :

- L'identité (email, téléphone, nom, casquettes) est copiée dans `user_archives`
  — trace pour litiges, obligations légales et anti-fraude.
- La ligne `users` est **anonymisée mais conservée** (`status = deleted`,
  email/téléphone à NULL, nom remplacé) : l'`id` reste valide pour l'intégrité
  des futures commandes/avis.
- Adresses et profils vendeur/livreur sont purgés.
- Le compte **Firebase est supprimé** : l'email et le numéro sont libérés pour
  une éventuelle réinscription.

## Émulateur Firebase : persistance locale

`npm run emulators` importe/exporte automatiquement les comptes de test dans
`.firebase-emulator/` (ignoré par git). Les comptes survivent donc aux
redémarrages. Pour repartir de zéro : supprimer ce dossier **et** vider les
tables utilisateurs de PostgreSQL (sinon données orphelines).

**Prérequis** : l'émulateur Storage nécessite **Java** (installé sur ce poste :
Temurin JRE 21 via `winget install EclipseAdoptium.Temurin.21.JRE`).

## Documents KYC vendeurs (conception)

- Stockage dans **Firebase Storage** (émulateur en local, port 9199 ; vrai
  bucket en production — même code).
- Chemins : `kyc/{firebaseUid}/...`. Les règles Storage (`storage.rules`)
  n'autorisent que l'écriture par le propriétaire (5 Mo max) et **interdisent
  toute lecture client**.
- Consultation réservée aux admins via `/api/admin/kyc?path=...` (firebase-admin
  contourne les règles côté serveur). Aucune URL publique ne mène aux documents.
- La demande vendeur référence les chemins en base (`seller_profiles`) ; le
  serveur vérifie que les chemins appartiennent bien au dossier du demandeur.

## Panier & commandes (conception)

- **Panier en base** (`cart_items`, lié au compte) : connexion requise pour
  acheter ; un article par produit, quantité bornée par le stock et la
  quantité minimum.
- **Prix de gros B2B** : appliqué automatiquement dès que la quantité atteint
  le palier du vendeur (`src/lib/pricing.ts`, partagé client/serveur — le
  serveur recalcule toujours, jamais confiance au client).
- **Un checkout = une commande par vendeur**, reliées par `group_id`
  (MVP n°101-102). Numéro unique `GK-AAMMJJ-XXXX`.
- **Snapshots** : les lignes de commande figent titre, prix appliqué et photo ;
  l'adresse de livraison est copiée dans la commande (modifier/supprimer
  l'adresse ensuite ne touche pas l'historique).
- **Stock décrémenté à la commande**, garanti par un `WHERE stock >= qté`
  transactionnel (échec propre si un autre acheteur passe avant).
- **Frais de livraison provisoires** : forfait 1 000 FCFA par vendeur (Lomé),
  remplacé par le vrai calcul au module Livraison.
- Les commandes naissent **`pending_payment`** : le paiement Escrow
  (itération 5) fera basculer vers `paid` → `processing` → `shipped` →
  `delivered`.

## Wallet & Escrow (conception — itération 5)

- **Un wallet par compte** (multi-casquettes oblige), créé automatiquement au
  premier accès. Solde maintenu sur `wallets`, chaque mouvement tracé dans
  `wallet_transactions` (grand livre, montants signés).
- **Recharge/retrait Mobile Money simulés en local** (comme les SMS) — en
  production, brancher un agrégateur (CinetPay/Semoa) dans
  `src/app/compte/wallet/actions.ts` (le garde-fou `SIMULATED` refuse tout
  paiement réel non configuré).
- **Cycle Escrow** : paiement wallet (au checkout ou depuis la commande) →
  fonds débités, commande `paid`, **rien n'est versé au vendeur** → le vendeur
  prépare puis expédie → **l'acheteur confirme la réception** → versement au
  vendeur **net de commission** (5 %, `PLATFORM_COMMISSION_RATE`). Les frais
  de livraison restent à la plateforme (financeront les livreurs).
- **Annulation** (avant expédition) : remboursement wallet intégral + re-stock.
- Tous les mouvements d'argent sont **transactionnels** avec garde de solde
  (`WHERE balance >= montant`) — pas de découvert possible.
- À venir : déblocage automatique après délai (n°119, module Litiges),
  remboursement sur litige (n°120), factures PDF (n°122-124).

## Administration

- L'admin est un booléen `is_admin` sur `users` ; promotion manuelle en SQL :
  `UPDATE users SET is_admin = true WHERE phone = '+228XXXXXXXX';`
- Interface sous `/admin` (garde serveur dans le layout). File de validation
  des vendeurs : approuver / refuser avec motif (visible par le demandeur,
  re-soumission possible après refus).
- Compte admin de test local : `admin@gkmarket.tg` / `admintest123`.
- Compte vendeur de test local : `+228 99 88 77 66` / `123456789`
  (boutique « Encart Électronique », approuvée).

## Gestion PostgreSQL (résumé opérationnel)

1. **Exécution** : conteneur Docker `postgres:16` via `docker-compose.yml` versionné — même version en local, staging et prod.
   *Exception temporaire (2026-06-11)* : en local, PostgreSQL 16 natif Windows est utilisé en attendant
   l'installation de Docker Desktop (contrainte de stockage). Même version majeure, même URL de connexion
   (`gkmarket:gkmarket_dev@localhost:5432/gkmarket`) — la bascule vers Docker sera transparente.
2. **Sécurité** : base jamais exposée à Internet (réseau interne uniquement) ; UFW (80/443/SSH), SSH par clé, secrets en variables d'environnement.
3. **Migrations** : tout changement de schéma = fichier SQL numéroté commité (Drizzle Kit ou Prisma Migrate). Local → CI/staging → prod. Jamais de modification manuelle en prod.
4. **Sauvegardes** : `pg_dump` quotidien chiffré vers stockage externe (Backblaze B2 / Contabo Object Storage, ~1 €/mois) ; archivage WAL (`wal-g`) pour restauration point-in-time dès que de l'argent réel circule ; test de restauration mensuel.
5. **Monitoring** : Netdata ou Uptime Kuma (disque, RAM, disponibilité). Mises à jour mineures via bump d'image Docker, testées en staging d'abord.

## Environnements

```
LOCAL                          STAGING                        PRODUCTION
Docker (Postgres + Next dev) → VPS ou Vercel preview        → VPS Contabo / Vercel
        │                            │                              │
        └── git push ──→ PR (CI: lint, tests, migrations) ──→ merge → déploiement
```

- Secrets par environnement (`.env.local` non commité ; variables CI/hébergeur).
- Clés FedaPay sandbox en staging, réelles en prod uniquement.

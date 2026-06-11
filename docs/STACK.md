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

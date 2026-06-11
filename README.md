# GK Market

Marketplace hybride **B2B & B2C** pour le Togo, portée par GK NÉGOCES en partenariat
avec FlowKraft Agency. MVP centré sur Lomé, avec paiement sécurisé par **Escrow**,
vendeurs vérifiés et livraison par livreurs partenaires.

## Documentation

- [Cahier des charges](docs/CAHIER%20DES%20CHARGES%20PLATEFORME.pdf) — vision et périmètre
- [Explosion du projet](docs/Explosion%20du%20projet.xlsx) — backlog des 639 fonctionnalités par phase
- [CHANGEMENTS.md](docs/CHANGEMENTS.md) — changements actés par rapport aux documents initiaux (**fait foi**)
- [STACK.md](docs/STACK.md) — décisions techniques et environnements
- [DESIGN.md](docs/DESIGN.md) — design system (dark glassmorphism, navy/or/émeraude)

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · PostgreSQL 16 · Drizzle ORM ·
Firebase Auth (à venir) · FedaPay (à venir)

## Démarrage local

Prérequis : Node.js 22+, Docker Desktop.

```bash
# 1. Dépendances
npm install

# 2. Variables d'environnement
copy .env.example .env

# 3. Base de données locale
docker compose up -d

# 4. Appliquer les migrations
npm run db:migrate

# 5. Lancer le serveur de développement
npm run dev
```

Le site est alors disponible sur http://localhost:3000.

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run lint` | Lint ESLint |
| `npm run db:generate` | Génère une migration SQL depuis `src/db/schema.ts` |
| `npm run db:migrate` | Applique les migrations à la base |
| `npm run db:studio` | Interface visuelle de la base (Drizzle Studio) |

## Structure

```
src/
  app/            Pages et layouts (App Router)
  components/ui/  Composants du design system (Button, Card, Input, Badge…)
  db/             Schéma Drizzle et client PostgreSQL
  lib/            Utilitaires
drizzle/          Migrations SQL versionnées (ne jamais modifier à la main)
docs/             Documentation projet
```

## Règles de travail

- Tout changement de schéma passe par une **migration versionnée** (`npm run db:generate`),
  jamais de modification manuelle de la base.
- Branches de fonctionnalité + pull request ; la CI (lint + build) doit passer avant merge.
- Les secrets ne sont **jamais** commités (`.env` est ignoré ; `.env.example` sert de modèle).

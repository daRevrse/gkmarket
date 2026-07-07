# Déploiement — Deal Lomé (deallome.com)

Dernière mise à jour : 2026-07-07. Runbook des commandes réellement utilisées
pour mettre en production et redéployer la plateforme.

## Vue d'ensemble

```
Poste local (Windows)                    VPS Contabo 144.91.84.51 (Ubuntu 24.04)
┌─────────────────────┐                 ┌──────────────────────────────────────┐
│ code + vérifs        │  git push      │ ~/deallome (clone GitHub)            │
│ (tsc, build)         │ ───────────►   │ docker compose -f                    │
│                      │  GitHub        │   docker-compose.prod.yml            │
│ ssh/scp (clé)        │ ───────────►   │  ├─ deallome-db     (postgres:16,    │
└─────────────────────┘   daRevrse/     │  │   réseau interne, jamais exposé)  │
                          gkmarket      │  ├─ deallome-app    (Next.js         │
                                        │  │   standalone, port interne 3000)  │
DNS deallome.com (A @ + www             │  └─ deallome-caddy  (80/443,         │
→ 144.91.84.51, géré chez Vercel)       │      TLS Let's Encrypt auto)         │
                                        └──────────────────────────────────────┘
Firebase `deallome-staging` : Auth (email + téléphone) & Storage
```

- **Code** : GitHub `daRevrse/gkmarket`, branche `main` (CI GitHub Actions :
  lint + build à chaque push).
- **Secrets** : `/home/deploy/deallome/.env` sur le VPS (chmod 600, jamais
  commité). Modèle : [`.env.production.example`](../.env.production.example).
- **UFW** : seuls 22 (SSH), 80 et 443 sont ouverts.

## 0. Prérequis (une fois par poste)

Accès SSH par clé (user `deploy`, sudo + docker) :

```powershell
# PowerShell — test de connexion
ssh -i C:\Users\Administrateur\.ssh\deallome_vps deploy@144.91.84.51 "echo ok"
```

```bash
# Git Bash — même clé, syntaxe POSIX
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 "echo ok"
```

> Astuce : ajouter un alias dans `~/.ssh/config` (`Host deallome`) pour taper
> simplement `ssh deallome`.

## 1. Routine — déployer un changement de code

À dérouler **après chaque changement ou amélioration** (UI, page, correctif…)
qui ne touche ni au schéma de base, ni aux variables d'environnement.

### 1.1 Vérifier en local

```bash
npx tsc --noEmit        # typecheck : doit sortir sans erreur
npm run build           # build de production : doit se terminer par exit 0
```

### 1.2 Commiter et pousser

```bash
git add <fichiers>
git commit -m "feat(...): description du changement"
git push origin main    # déclenche aussi la CI (lint + build)
```

### 1.3 Déployer sur le VPS

Une seule commande SSH fait tout (pull → build → redémarrage → état) :

```bash
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 '
  cd ~/deallome &&
  git pull --quiet && git log --oneline -1 &&
  docker compose -f docker-compose.prod.yml build app > /tmp/build.log 2>&1;
  echo "BUILD_EXIT=$?";
  docker compose -f docker-compose.prod.yml up -d app > /dev/null 2>&1;
  echo "UP_EXIT=$?"; sleep 6;
  docker compose -f docker-compose.prod.yml ps --format "{{.Name}} {{.State}}"
'
```

Attendu : `BUILD_EXIT=0`, `UP_EXIT=0`, les trois conteneurs `running`.
En cas d'échec de build : `tail -40 /tmp/build.log` sur le VPS.

### 1.4 Vérifier en production

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://deallome.com/          # 200
curl -sS https://deallome.com/ | grep -o "<title>[^<]*</title>"          # titre attendu
```

## 2. Cas particuliers

### 2.1 Changement de schéma (migrations Drizzle)

1. En local, après modification de `src/db/schema.ts` :

```bash
npm run db:generate     # crée drizzle/XXXX_nom.sql — à commiter avec le code
```

2. Pousser (`git push`), puis sur le VPS **avant** de redémarrer l'app :

```bash
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 '
  cd ~/deallome && git pull --quiet &&
  docker compose -f docker-compose.prod.yml --profile tools run --rm migrator
'
```

3. Enchaîner avec la routine 1.3 (build + up de l'app).

> Règle : jamais de modification manuelle du schéma en prod — tout passe par
> un fichier de migration commité (cf. docs/STACK.md).

### 2.2 Variables d'environnement serveur (`.env` du VPS)

Pour `CRON_SECRET`, `BREVO_API_KEY`, `DEMO_MODE`, `FIREBASE_SERVICE_ACCOUNT`… :

```bash
# éditer le fichier sur le VPS
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 'nano ~/deallome/.env'

# recréer l'app pour prendre la nouvelle valeur (pas de rebuild nécessaire)
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 \
  'cd ~/deallome && docker compose -f docker-compose.prod.yml up -d app'
```

### 2.3 Variables `NEXT_PUBLIC_*` (config Firebase côté client)

Elles sont **inlinées dans le bundle au build** (args du service `app` dans
`docker-compose.prod.yml`). Après modification dans `.env` : **rebuild
obligatoire** → routine 1.3 complète (le `build app` relit les args).

### 2.4 Caddy / domaine

Le `Caddyfile` est monté dans le conteneur. Après modification (commit + pull) :

```bash
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 \
  'cd ~/deallome && docker compose -f docker-compose.prod.yml restart caddy'
```

Le certificat TLS se renouvelle tout seul. Si le domaine change : mettre à
jour le DNS (A → 144.91.84.51) **avant** de redémarrer Caddy.

### 2.5 Seed des catégories (idempotent)

```bash
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@144.91.84.51 \
  'cd ~/deallome && docker compose -f docker-compose.prod.yml exec -T db \
   psql -U deallome -d deallome < drizzle/seed-categories.sql'
```

## 3. Diagnostic

```bash
# état des conteneurs
ssh ... 'cd ~/deallome && docker compose -f docker-compose.prod.yml ps'

# logs applicatifs / proxy / base
ssh ... 'cd ~/deallome && docker compose -f docker-compose.prod.yml logs app --tail 50'
ssh ... 'cd ~/deallome && docker compose -f docker-compose.prod.yml logs caddy --tail 50'

# console SQL directe
ssh ... 'cd ~/deallome && docker compose -f docker-compose.prod.yml exec db \
  psql -U deallome -d deallome'

# promouvoir un admin
# UPDATE users SET is_admin = true WHERE phone = '+228XXXXXXXX';
```

Pièges connus :
- **Docker Hub capricieux sur ce VPS** (`DeadlineExceeded` au build) →
  pré-tirer les images de base puis relancer :
  `docker pull node:22-bookworm-slim && docker pull caddy:2-alpine`
- Les **longues sorties SSH se tronquent** → rediriger vers un fichier
  (`> /tmp/x.log 2>&1`) puis `tail`.

## 4. Rollback

```bash
# en local : annuler le commit fautif proprement
git log --oneline -5
git revert <sha>
git push origin main
# puis dérouler la routine 1.3
```

(Le rollback de migration n'est pas automatisé : écrire une migration inverse.)

## 5. Sauvegardes & crons (crontab du user `deploy`)

| Heure (UTC) | Tâche | Script |
|---|---|---|
| 03:00 | `pg_dump` gzippé → `/home/deploy/backups` (rotation 7 j) | `~/deallome/backup-db.sh` |
| 06:00 | Déblocage Escrow auto (`/api/cron/escrow`, Bearer `CRON_SECRET`) | `~/deallome/cron-escrow.sh` |

```bash
# vérifier / restaurer
ssh ... 'crontab -l'
ssh ... 'ls -lh /home/deploy/backups/'
# restauration (⚠️ écrase les données courantes) :
# zcat backup.sql.gz | docker exec -i deallome-db psql -U deallome -d deallome
```

> ⚠️ Backups **locaux au VPS** uniquement pour l'instant — externalisation
> chiffrée (Backblaze B2/Contabo Object Storage) à mettre en place avant de
> manipuler de l'argent réel (cf. STACK.md).

## 6. Référentiel

| Élément | Valeur |
|---|---|
| URL de production | https://deallome.com (www → apex) |
| VPS | Contabo `144.91.84.51`, Ubuntu 24.04, user `deploy` (clé SSH) |
| Répertoire de déploiement | `/home/deploy/deallome` |
| Dépôt | `github.com/daRevrse/gkmarket`, branche `main` |
| Conteneurs | `deallome-app`, `deallome-db`, `deallome-caddy` |
| Base | PostgreSQL 16, db/user `deallome`, réseau Docker interne uniquement |
| Firebase | projet `deallome-staging` (Auth email + téléphone, SMS région TG) |
| Numéro de test Firebase | `+228 90 00 00 01`, code `123456` (aucun SMS) |
| Mode démo | `DEMO_MODE=1` (paiements Mobile Money simulés) |
| Emails | simulés tant que `BREVO_API_KEY` absent (journal `email_outbox`) |

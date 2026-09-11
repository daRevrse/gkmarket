# Déploiement — Deal Lomé (deallome.com)

Dernière mise à jour : 2026-09-11 (reconstruction sur un nouveau VPS après la
perte de l'ancien, `144.91.84.51`, pour non-paiement). Runbook des commandes
réellement utilisées pour mettre en production et redéployer la plateforme.

## Vue d'ensemble

```
Poste local (Windows)                    VPS Contabo 161.97.182.152 (Ubuntu 24.04)
┌─────────────────────┐                 ┌──────────────────────────────────────┐
│ code + vérifs        │  git push      │ ~/deallome (clone GitHub)            │
│ (tsc, build)         │ ───────────►   │ docker compose -f                    │
│                      │  GitHub        │   docker-compose.prod.yml            │
│ ssh/scp (clé)        │ ───────────►   │  ├─ deallome-db     (postgres:16,    │
└─────────────────────┘   daRevrse/     │  │   réseau interne, jamais exposé)  │
                          gkmarket      │  ├─ deallome-app    (Next.js         │
                                        │  │   standalone, port interne 3000)  │
DNS deallome.com (A @ + www             │  └─ deallome-caddy  (80/443,         │
→ 161.97.182.152, géré chez Vercel)     │      TLS Let's Encrypt auto)         │
                                        └──────────────────────────────────────┘
Firebase `deallome-staging` : Auth (email + téléphone) & Storage
```

- **Code** : GitHub `daRevrse/gkmarket`, branche `main` (CI GitHub Actions :
  lint + build à chaque push).
- **Secrets** : `/home/deploy/deallome/.env` sur le VPS (chmod 600, jamais
  commité). Modèle : [`.env.production.example`](../.env.production.example).
  **Copie de référence hors serveur** : `C:\Users\Administrateur\deallome-deploy\prod.env`
  — toute modification du `.env` du VPS doit y être reportée (c'est elle qui
  permet de reconstruire, cf. section 6).
- **UFW** : seuls 22 (SSH), 80 et 443 sont ouverts. **SSH par clé uniquement**
  (mot de passe désactivé, `root` accessible par clé seulement).

## 0. Prérequis (une fois par poste)

Accès SSH par clé (user `deploy`, sudo + docker) :

```powershell
# PowerShell — test de connexion
ssh -i C:\Users\Administrateur\.ssh\deallome_vps deploy@161.97.182.152 "echo ok"
```

```bash
# Git Bash — même clé, syntaxe POSIX
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 "echo ok"
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
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 '
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
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 '
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
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 'nano ~/deallome/.env'

# recréer l'app pour prendre la nouvelle valeur (pas de rebuild nécessaire)
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 \
  'cd ~/deallome && docker compose -f docker-compose.prod.yml up -d app'
```

### 2.3 Variables `NEXT_PUBLIC_*` (config Firebase côté client)

Elles sont **inlinées dans le bundle au build** (args du service `app` dans
`docker-compose.prod.yml`). Après modification dans `.env` : **rebuild
obligatoire** → routine 1.3 complète (le `build app` relit les args).

### 2.4 Caddy / domaine

Le `Caddyfile` est monté dans le conteneur. Après modification (commit + pull) :

```bash
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 \
  'cd ~/deallome && docker compose -f docker-compose.prod.yml restart caddy'
```

Le certificat TLS se renouvelle tout seul. Si le domaine change : mettre à
jour le DNS (A → 161.97.182.152) **avant** de redémarrer Caddy.

### 2.5 Seed des catégories (idempotent)

```bash
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 \
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

# promouvoir un admin (après sa première connexion ; `phone` est souvent vide
# pour les comptes téléphone, préférer l'email ou l'UID Firebase)
# UPDATE users SET is_admin = true WHERE email = '…' OR firebase_uid = '…';
```

Pièges connus :
- **Docker Hub capricieux sur ce VPS** (`DeadlineExceeded` au build) →
  pré-tirer les images de base puis relancer :
  `docker pull node:22-bookworm-slim && docker pull caddy:2-alpine`
- Les **longues sorties SSH se tronquent** → rediriger vers un fichier
  (`> /tmp/x.log 2>&1`) puis `tail`.
- **PowerShell 5.1 retire les guillemets** des commandes passées à `ssh` →
  utiliser Git Bash (heredoc `ssh … 'bash -s' <<'EOF'`).
- Dans un `ssh … 'bash -s' <<'EOF'`, **`docker compose run`/`exec` lisent
  l'entrée standard et avalent la suite du script** → toujours `-T` ou
  `< /dev/null`.
- Les fichiers de `deploy` dans **`/dev/shm` sont effacés à la déconnexion**
  (systemd `RemoveIPC`) : n'y rien laisser d'une session à l'autre.

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

Scripts versionnés dans [`deploy/`](../deploy/), copiés dans `~/ops/` sur le
VPS (hors du clone git) ; crontab = [`deploy/crontab`](../deploy/crontab).
Heure du serveur : UTC (= heure de Lomé).

| Heure (UTC) | Tâche | Script | Journal |
|---|---|---|---|
| 03:00 | `pg_dump` gzippé → `~/backups` (7 j) **+ copie chiffrée hors VPS** → `gs://deallome-staging.firebasestorage.app/backups/db/` (30 j) | `~/ops/backup-db.sh` | `~/backups/backup.log` |
| 06:00 | Déblocage auto des paiements sécurisés (`GET /api/cron/escrow`, Bearer `CRON_SECRET`) | `~/ops/cron-escrow.sh` | `~/ops/cron-escrow.log` |

Mettre à jour un script : modifier `deploy/…`, commit + push, puis sur le VPS
`cd ~/deallome && git pull && cp deploy/*.sh ~/ops/ && crontab deploy/crontab`.

**Chiffrement (`age`)** : le VPS ne détient que la clé **publique**
(`BACKUP_AGE_RECIPIENT` dans `.env`). La clé **privée** est
`C:\Users\Administrateur\deallome-deploy\backup-age.key`, à doubler dans un
gestionnaire de mots de passe : **sans elle, les copies hors VPS sont
illisibles**. Le préfixe `backups/` est refusé aux clients par les règles
Firebase Storage (seul le compte de service y accède).

```bash
# état
ssh ... 'crontab -l; ls -lh ~/backups/; tail -3 ~/backups/backup.log'

# test de restauration de la dernière copie hors VPS (base temporaire, sans risque)
ssh -i /c/Users/Administrateur/.ssh/deallome_vps deploy@161.97.182.152 \
  'bash ~/ops/restore-db.sh --check' < /c/Users/Administrateur/deallome-deploy/backup-age.key

# restauration depuis une copie locale du VPS (⚠️ la base cible doit être vide)
# zcat ~/backups/deallome-AAAAMMJJ-HHMMSS.sql.gz | docker exec -i deallome-db psql -U deallome -d deallome
```

La clé privée est lue sur l'entrée standard de `restore-db.sh` : elle n'est
jamais écrite sur le serveur.

## 6. Reconstruction complète (VPS perdu, nouveau serveur)

Procédure suivie le 2026-09-11. Prérequis sur le poste : `prod.env` et
`backup-age.key` (dans `C:\Users\Administrateur\deallome-deploy\`), clé SSH
`deallome_vps`, CLI Vercel connectée à l'équipe `flowkraft-agencys-projects`.

1. **Autoriser la clé SSH** (l'utilisateur tape le mot de passe root, une fois) :
   ```bash
   cat ~/.ssh/deallome_vps.pub | ssh root@<IP> "mkdir -p ~/.ssh && chmod 700 ~/.ssh && tr -d '\r' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
   ```
2. **DNS** (tôt : Caddy en a besoin pour les certificats ; TTL 60 s) :
   ```bash
   vercel dns ls deallome.com --scope flowkraft-agencys-projects
   vercel dns add deallome.com '@' A <IP> --scope flowkraft-agencys-projects
   vercel dns add deallome.com www A <IP> --scope flowkraft-agencys-projects
   vercel dns remove <id-des-anciens-A> --scope flowkraft-agencys-projects --non-interactive --yes
   ```
3. **Préparer le serveur** (Docker, user `deploy`, UFW, swap, SSH par clé, UTC) :
   ```bash
   ssh -i ~/.ssh/deallome_vps root@<IP> 'bash -s' < deploy/bootstrap-vps.sh
   ```
4. **Code, secrets, scripts** :
   ```bash
   ssh -i ~/.ssh/deallome_vps deploy@<IP> 'git clone https://github.com/daRevrse/gkmarket.git ~/deallome'
   scp -i ~/.ssh/deallome_vps /c/Users/Administrateur/deallome-deploy/prod.env deploy@<IP>:deallome/.env
   scp -i ~/.ssh/deallome_vps deploy/*.sh deploy/crontab deploy@<IP>:ops/
   ssh -i ~/.ssh/deallome_vps deploy@<IP> 'chmod 600 ~/deallome/.env && chmod 700 ~/ops/*.sh'
   ```
5. **Base** : `docker compose -f docker-compose.prod.yml up -d db`, puis
   - cas normal : **restaurer la dernière sauvegarde** hors VPS
     `ssh … deploy@<IP> 'bash ~/ops/restore-db.sh' < …/backup-age.key` ;
   - sinon, base vierge : seeds `drizzle/seed-categories.sql` puis
     `drizzle/seed-demo.sql` (cf. 2.5) ;
   - dans les deux cas, lancer ensuite le `migrator` (applique les migrations
     plus récentes que la sauvegarde) :
     `docker compose -f docker-compose.prod.yml --profile tools run --rm -T migrator < /dev/null`.
6. **App + HTTPS** : routine 1.3 (`build app` puis `up -d`), vérifier
   « certificate obtained successfully » dans les logs de `deallome-caddy`.
7. **Crons** : `crontab ~/ops/crontab`, puis lancer une fois
   `~/ops/backup-db.sh` et `~/ops/cron-escrow.sh`.
8. **Brevo** : autoriser la nouvelle IP sur
   https://app.brevo.com/security/authorised_ips (sinon HTTP 401).
9. **Admins** (si base vierge) : `UPDATE users SET is_admin = true WHERE firebase_uid = '…';`
   après leur première connexion.
10. Mettre à jour l'IP dans ce document.

## 7. Référentiel

| Élément | Valeur |
|---|---|
| URL de production | https://deallome.com (www → apex) |
| VPS | Contabo `161.97.182.152` (depuis le 2026-09-11), Ubuntu 24.04, 4 vCPU / 8 Go, user `deploy` (clé SSH) |
| Répertoire de déploiement | `/home/deploy/deallome` (scripts d'exploitation : `/home/deploy/ops`) |
| Sauvegardes | `~/backups` (7 j) + `gs://deallome-staging.firebasestorage.app/backups/db/` chiffrées `age` (30 j) |
| Clé de déchiffrement | `C:\Users\Administrateur\deallome-deploy\backup-age.key` (+ gestionnaire de mots de passe) |
| Dépôt | `github.com/daRevrse/gkmarket`, branche `main` |
| Conteneurs | `deallome-app`, `deallome-db`, `deallome-caddy` |
| Base | PostgreSQL 16, db/user `deallome`, réseau Docker interne uniquement |
| Firebase | projet `deallome-staging` (Auth email + téléphone, SMS région TG) |
| Numéro de test Firebase | `+228 90 00 00 01`, code `123456` (aucun SMS) |
| Mode démo | `DEMO_MODE=1` (paiements Mobile Money simulés) |
| Emails | Brevo (`BREVO_API_KEY`), IP du VPS à autoriser côté Brevo ; journal `email_outbox` |

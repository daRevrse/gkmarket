#!/usr/bin/env bash
# Sauvegarde quotidienne de la base Deal Lomé (crontab du user deploy, 03:00 UTC).
#  1. pg_dump gzippé dans ~/backups (rotation 7 jours) ;
#  2. copie chiffrée (age) HORS du VPS, dans le bucket Google Cloud du projet
#     Firebase, sous backups/db/ (rotation 30 jours).
# Le serveur ne détient que la clé publique : la clé privée de déchiffrement est
# conservée hors serveur (cf. docs/DEPLOIEMENT.md, « Sauvegardes »).
set -euo pipefail

APP_DIR="$HOME/deallome"
BACKUP_DIR="$HOME/backups"
KEEP_LOCAL_DAYS=7
KEEP_REMOTE_DAYS=30

# Lecture ciblée du .env : il n'est pas « sourçable » (le JSON du compte de
# service contient des espaces et des guillemets).
env_get() { grep -m1 "^$1=" "$APP_DIR/.env" | cut -d= -f2-; }

recipient=$(env_get BACKUP_AGE_RECIPIENT)
bucket=$(env_get FIREBASE_STORAGE_BUCKET)
if [ -z "$recipient" ] || [ -z "$bucket" ]; then
  echo "$(date -u +%FT%TZ) ERREUR : BACKUP_AGE_RECIPIENT ou FIREBASE_STORAGE_BUCKET absent du .env" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
file="$BACKUP_DIR/deallome-$(date -u +%Y%m%d-%H%M%S).sql.gz"

docker exec deallome-db pg_dump -U deallome -d deallome | gzip -9 > "$file"
chmod 600 "$file"
gzip -t "$file"
find "$BACKUP_DIR" -name 'deallome-*.sql.gz' -mtime +"$KEEP_LOCAL_DAYS" -delete

export RCLONE_GCS_SERVICE_ACCOUNT_CREDENTIALS
RCLONE_GCS_SERVICE_ACCOUNT_CREDENTIALS=$(env_get FIREBASE_SERVICE_ACCOUNT)
export RCLONE_GCS_BUCKET_POLICY_ONLY=true
remote=":gcs:$bucket/backups/db"
age -r "$recipient" "$file" | rclone -q rcat "$remote/$(basename "$file").age"
rclone -q delete "$remote" --min-age "${KEEP_REMOTE_DAYS}d"

echo "$(date -u +%FT%TZ) OK $(basename "$file") ($(du -h "$file" | cut -f1)) -> $remote"

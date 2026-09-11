#!/usr/bin/env bash
# Restauration de la base depuis la copie chiffrée hors VPS (bucket GCS, backups/db/).
# La clé privée age est lue sur l'entrée standard : elle n'est jamais écrite sur le serveur.
#   ssh deploy@<IP> 'bash ~/ops/restore-db.sh --check' < backup-age.key  # test dans une base temporaire
#   ssh deploy@<IP> 'bash ~/ops/restore-db.sh' < backup-age.key          # dans la base de prod (doit être VIDE)
# Argument optionnel : nom du fichier à restaurer (défaut : le plus récent).
set -euo pipefail

check=false
name=""
for arg in "$@"; do
  case "$arg" in
    --check) check=true ;;
    *) name=$arg ;;
  esac
done

key=$(cat)
env_get() { grep -m1 "^$1=" "$HOME/deallome/.env" | cut -d= -f2-; }
export RCLONE_GCS_SERVICE_ACCOUNT_CREDENTIALS
RCLONE_GCS_SERVICE_ACCOUNT_CREDENTIALS=$(env_get FIREBASE_SERVICE_ACCOUNT)
export RCLONE_GCS_BUCKET_POLICY_ONLY=true
remote=":gcs:$(env_get FIREBASE_STORAGE_BUCKET)/backups/db"

[ -n "$name" ] || name=$(rclone -q lsf "$remote" | sort | tail -1)
[ -n "$name" ] || { echo "Aucune sauvegarde dans $remote" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
rclone -q copyto "$remote/$name" "$tmp/dump.age"
age -d -i <(printf '%s\n' "$key") -o "$tmp/dump.sql.gz" "$tmp/dump.age"
unset key
gzip -t "$tmp/dump.sql.gz"

db=deallome
if $check; then
  db=restore_check
  docker exec deallome-db dropdb -U deallome --if-exists "$db"
  docker exec deallome-db createdb -U deallome "$db"
fi
# ON_ERROR_STOP : sur une base non vide, s'arrête dès le premier objet existant.
zcat "$tmp/dump.sql.gz" | docker exec -i deallome-db psql -U deallome -d "$db" -q -v ON_ERROR_STOP=1 > /dev/null

q="select (select count(*) from users)||' utilisateurs, '||(select count(*) from products)||' produits, '||(select count(*) from orders)||' commandes'"
echo "$name restauré dans « $db » : $(docker exec deallome-db psql -U deallome -d "$db" -At -c "$q")"
if $check; then
  docker exec deallome-db dropdb -U deallome "$db"
  echo "base temporaire supprimée"
fi

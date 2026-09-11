#!/usr/bin/env bash
# Préparation d'un VPS Ubuntu 24.04 vierge pour Deal Lomé — à lancer en root, idempotent.
# Depuis le poste local (Git Bash), une fois la clé deallome_vps autorisée pour root :
#   ssh -i ~/.ssh/deallome_vps root@<IP> 'bash -s' < deploy/bootstrap-vps.sh
# Suite (clone, .env, base, app, crons) : docs/DEPLOIEMENT.md, section « Reconstruction ».
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1

# Heure du serveur = UTC (= heure de Lomé) : les crons sont exprimés en UTC.
timedatectl set-timezone UTC

apt-get update -q
apt-get install -y -q ca-certificates curl git ufw age rclone

# Docker Engine + plugin compose (dépôt officiel Docker).
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# Utilisateur de déploiement : mêmes clés SSH que root, sudo sans mot de passe, groupe docker.
id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG sudo,docker deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-deploy
chmod 440 /etc/sudoers.d/90-deploy
visudo -cf /etc/sudoers.d/90-deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
install -d -m 700 -o deploy -g deploy /home/deploy/ops /home/deploy/backups

# Swap de 2 Go : marge pour le build Next.js.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
fi
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Pare-feu : SSH, HTTP et HTTPS uniquement (Postgres n'est jamais publié par Docker).
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# SSH par clé uniquement. Le fichier « 00- » est lu avant 50-cloud-init.conf :
# pour sshd, la première valeur rencontrée l'emporte.
cat > /etc/ssh/sshd_config.d/00-deallome.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
mkdir -p /run/sshd
sshd -t
systemctl restart ssh

echo "BOOTSTRAP_OK"

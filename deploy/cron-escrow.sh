#!/usr/bin/env bash
# Déblocage automatique des paiements sécurisés (crontab du user deploy, 06:00 UTC).
# Appelle GET /api/cron/escrow avec le CRON_SECRET du .env.
set -euo pipefail

secret=$(grep -m1 '^CRON_SECRET=' "$HOME/deallome/.env" | cut -d= -f2-)
result=$(curl -fsS -m 120 -H "Authorization: Bearer $secret" https://deallome.com/api/cron/escrow)
echo "$(date -u +%FT%TZ) $result"

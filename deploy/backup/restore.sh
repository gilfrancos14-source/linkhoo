#!/usr/bin/env bash
# Restauration Ilehya : base PostgreSQL + fichiers stockés.
#
# Usage :  ./deploy/backup/restore.sh /var/backups/ilehya/20261117-020000
#
# ATTENTION : la base courante est REMPLACÉE. Faire une sauvegarde juste avant.

set -euo pipefail

SOURCE="${1:?Usage : restore.sh <dossier_de_sauvegarde>}"
STORAGE_DIR="${STORAGE_DIR:-/var/lib/ilehya/storage}"
PG_CONTAINER="${PG_CONTAINER:-ilehya-postgres}"
PG_USER="${PG_USER:-ilehya}"
PG_DB="${PG_DB:-ilehya}"

[ -f "$SOURCE/database.dump" ] || { echo "Sauvegarde introuvable : $SOURCE/database.dump"; exit 1; }

echo "[$(date -Is)] Restauration de la base depuis $SOURCE/database.dump"
docker exec -i "$PG_CONTAINER" pg_restore \
  --username="$PG_USER" \
  --dbname="$PG_DB" \
  --clean --if-exists \
  --no-owner --no-acl \
  < "$SOURCE/database.dump"

if [ -f "$SOURCE/storage.tar.gz" ]; then
  echo "[$(date -Is)] Restauration des fichiers"
  mkdir -p "$STORAGE_DIR"
  tar -xzf "$SOURCE/storage.tar.gz" -C "$STORAGE_DIR"
fi

echo "[$(date -Is)] Restauration terminée. Redémarrer l'API :"
echo "  docker compose -f docker-compose.prod.yml restart api"

#!/usr/bin/env bash
# Sauvegarde Ilehya : base PostgreSQL + fichiers stockés.
#
# Usage :  ./deploy/backup/backup.sh [chemin_de_sauvegarde]
#
# Variables d'environnement (facultatives) :
#   BACKUP_DIR      défaut /var/backups/ilehya
#   STORAGE_DIR     défaut /var/lib/ilehya/storage
#   RETENTION_DAYS  défaut 14
#   PG_CONTAINER    défaut ilehya-postgres
#   PG_USER / PG_DB défaut ilehya

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ilehya}"
STORAGE_DIR="${STORAGE_DIR:-/var/lib/ilehya/storage}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PG_CONTAINER="${PG_CONTAINER:-ilehya-postgres}"
PG_USER="${PG_USER:-ilehya}"
PG_DB="${PG_DB:-ilehya}"

timestamp="$(date +%Y%m%d-%H%M%S)"
target="${1:-$BACKUP_DIR/$timestamp}"

mkdir -p "$target"

echo "[$(date -Is)] Sauvegarde de la base…"
docker exec "$PG_CONTAINER" pg_dump \
  --username="$PG_USER" \
  --dbname="$PG_DB" \
  --format=custom \
  --no-owner \
  --no-acl > "$target/database.dump"

if [ -d "$STORAGE_DIR" ]; then
  echo "[$(date -Is)] Sauvegarde des fichiers…"
  tar -czf "$target/storage.tar.gz" -C "$STORAGE_DIR" .
else
  echo "[$(date -Is)] ATTENTION : $STORAGE_DIR introuvable, fichiers non sauvegardés"
fi

cat > "$target/manifest.txt" <<EOF
date=$timestamp
database=$PG_DB
storage=$STORAGE_DIR
EOF

echo "[$(date -Is)] Sauvegarde terminée : $target"

# Rotation : on garde RETENTION_DAYS jours.
if [ -d "$BACKUP_DIR" ]; then
  find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} +
fi

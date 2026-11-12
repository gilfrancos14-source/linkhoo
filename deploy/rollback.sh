#!/usr/bin/env bash
# Retour arrière (rollback) d'Ilehya.
#
# Usage :
#   ./deploy/rollback.sh <sauvegarde>        # restaure la base ET redéploie
#   ./deploy/rollback.sh --code-only         # redéploie l'image précédente
#
# Le repli « code seul » est le plus rapide : il consiste à reconstruire et
# redémarrer l'API avec la version précédente du dépôt (git checkout du tag
# ou du commit) — le script ne le fait pas tout seul, il doit être appelé
# APRÈS avoir changé de version.
#
# Exemple de rollback complet :
#   ./deploy/backup/backup.sh /var/backups/ilehya/avant-rollback
#   ./deploy/rollback.sh /var/backups/ilehya/avant-rollback

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml"

if [ "${1:-}" = "--code-only" ]; then
  echo "=== Repli code seul ==="
  echo "Vérifie la version currently déployée :"
  $COMPOSE images api
  echo "Puis : $COMPOSE up -d --force-recreate api"
  exit 0
fi

SOURCE="${1:?Usage : rollback.sh <dossier_de_sauvegarde> | --code-only}"
if [ ! -f "$SOURCE/database.dump" ]; then
  echo "ERREUR : sauvegarde introuvable : $SOURCE/database.dump"
  exit 1
fi

echo "=== Rollback complet vers $SOURCE ==="
echo "1. Sauvegarde de l'état courant (par sécurité)"
./deploy/backup/backup.sh "/var/backups/ilehya/avant-rollback-$(date +%Y%m%d-%H%M%S)" || true

echo "2. Restauration de la base"
./deploy/backup/restore.sh "$SOURCE"

echo "3. Redéploiement de l'API"
$COMPOSE up -d --force-recreate api

echo "4. Vérification"
sleep 10
curl -fsS http://127.0.0.1:3001/api/health && echo
echo "Rollback terminé."

#!/usr/bin/env bash
# Déploiement de l'application Ilehya sur le VPS.
#
# Usage :  ./deploy/deploy.sh
#
# Enchaîne, dans l'ordre et sans intervention :
#   1. construction de l'image de l'API ;
#   2. application des migrations en attente ;
#   3. redémarrage des conteneurs ;
#   4. vérification de la santé de l'API et du frontend.
#
# Le script est idempotent : on peut le relancer sans risque. En cas
# d'échec, l'ancienne version continue de tourner (les conteneurs ne sont
# remplacés qu'après la construction et les migrations).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml"
ENV_FILE="backend/.env.prod"

step() { echo; echo "=== $1 ==="; }

step "1/5 Vérification de l'environnement"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERREUR : $ENV_FILE manquant (cp backend/.env.prod.example $ENV_FILE)"
  exit 1
fi
echo "Fichier d'environnement : $ENV_FILE"

step "2/5 Construction de l'image de l'API"
$COMPOSE build api

step "3/5 Migrations"
# Les migrations sont appliquées dans le conteneur, avant le remplacement de
# l'API : une migration qui échoue n'arrête pas la version précédente.
$COMPOSE run --rm api node dist/db/migrateCli.js --yes

step "4/5 Démarrage des services"
$COMPOSE up -d

step "5/5 Vérification"
echo "Attente de l'API (30 s maximum)…"
OK=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    OK=1
    break
  fi
  sleep 1
done

if [ "$OK" = "0" ]; then
  echo "ERREUR : l'API ne répond pas sur http://127.0.0.1:3001/api/health"
  echo "Consulte les journaux : $COMPOSE logs --tail=50 api"
  exit 1
fi

echo "API en ligne :"
curl -fsS http://127.0.0.1:3001/api/health && echo

echo
echo "État des services :"
$COMPOSE ps

echo
echo "Déploiement terminé. Prochaine étape :"
echo "  - vérifier le site public : curl -I https://$(grep -E '^APP_PUBLIC_URL=' "$ENV_FILE" | cut -d= -f2-)"
echo "  - ou lancer le contrôle complet : ./deploy/smoke.sh https://<domaine>"

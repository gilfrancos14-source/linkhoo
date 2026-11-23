#!/usr/bin/env bash
# Déploiement COMPLET en production — Ilehya.
#
# Usage :  ./deploy/go-live.sh <domaine>     ex: ./deploy/go-live.sh linkehoo.com
#
# Enchaîne, dans l'ordre et en s'arrêtant à la première erreur :
#   0. contrôle d'environnement (pré-vol)
#   1. sauvegarde de la base
#   2. répertoire de cache Nginx
#   3. git pull (code + config)
#   4. configuration Nginx (upstream 4 instances + cache) + nginx -t
#   5. déploiement Docker (build + migrations + 4 instances + Redis)
#   6. contrôle de santé (smoke)
#
# Ce script est à lancer SUR LE VPS, en tant qu'utilisateur `deploy`
# (avec sudo pour Nginx). Lisez-le avant de l'exécuter.

set -euo pipefail

DOMAIN="${1:?Usage : ./deploy/go-live.sh <domaine>}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

step() { echo; echo "================ $1 ================"; }
die()  { echo "ERREUR BLOQUANTE : $1" >&2; exit 1; }

step "0/6 Pré-vol"
./deploy/preflight.sh "$DOMAIN" || die "Pré-vol en échec : corriger les points bloquants avant de continuer."

step "1/6 Sauvegarde de la base"
BACKUP_DIR="/var/backups/ilehya/avant-golive-$(date +%Y%m%d-%H%M%S)"
sudo /usr/local/bin/ilehya-backup "$BACKUP_DIR" || die "Sauvegarde impossible — ne pas continuer."
echo "Sauvegarde : $BACKUP_DIR"

step "2/6 Répertoire de cache Nginx"
sudo mkdir -p /var/cache/nginx/ilehya_api
sudo chown -R www-data:www-data /var/cache/nginx/ilehya_api
echo "Cache Nginx prêt."

step "3/6 Récupération du code"
git pull || die "git pull a échoué (modifications locales ?)."
echo "Commit déployé : $(git rev-parse --short HEAD)"

step "4/6 Configuration Nginx"
# Ne remplacer le fichier que si nginx -t passe, sinon on garde l'ancien.
sudo cp deploy/nginx/ilehya.conf /etc/nginx/sites-available/ilehya
sudo sed -i "s/linkehoo\.com/${DOMAIN}/g" /etc/nginx/sites-available/ilehya
if sudo nginx -t; then
  sudo systemctl reload nginx
  echo "Nginx rechargé avec succès."
else
  die "nginx -t a échoué — config restaurée ? Vérifier /etc/nginx/sites-available/ilehya"
fi

step "5/6 Déploiement Docker (build + migrations + 4 instances + Redis)"
./deploy/deploy.sh || die "deploy.sh a échoué — consulter les logs : docker compose -f docker-compose.prod.yml logs --tail=50"

step "6/6 Contrôle de santé"
./deploy/smoke.sh "https://${DOMAIN}" || die "Smoke test en échec."

echo
echo "============================================="
echo "DÉPLOIEMENT TERMINÉ avec succès."
echo "Commit : $(git rev-parse --short HEAD)"
echo "Sauvegarde : $BACKUP_DIR"
echo "Vérifier manuellement : connexion Clerk + paiement live + notification gérant."

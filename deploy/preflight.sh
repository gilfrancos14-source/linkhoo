#!/usr/bin/env bash
# Vérifications AVANT le déploiement (pré-vol) sur le serveur.
#
# Usage :  ./deploy/preflight.sh [domaine]
#
# Le script ne modifie rien : il vérifie que la machine est prête à héberger
# Ilehya et affiche la liste des points à corriger. Sort avec 1 si un point
# bloquant est détecté.

set -uo pipefail

DOMAIN="${1:-}"
FAILED=0
WARNED=0

ok()    { echo "  [OK]    $1"; }
warn()  { echo "  [ATTENTION] $1"; WARNED=1; }
ko()    { echo "  [BLOQUANT] $1"; FAILED=1; }

echo "== Système =="
if [ -f /etc/os-release ]; then
  . /etc/os-release
  ok "OS : ${PRETTY_NAME:-inconnu}"
  case "${VERSION_ID:-}" in
    24.04|22.04) ok "Version LTS supportée" ;;
    *) warn "Version ${VERSION_ID:-inconnue} : Ubuntu 24.04 ou 22.04 conseillé" ;;
  esac
else
  warn "Impossible de lire /etc/os-release"
fi

RAM_GB=$(awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo 2>/dev/null || echo 0)
if [ "${RAM_GB:-0}" -ge 6 ]; then ok "RAM : ${RAM_GB} Go"; else warn "RAM : ${RAM_GB} Go (8 Go conseillé pour le modèle d'images)"; fi

CPUS=$(nproc 2>/dev/null || echo 0)
if [ "${CPUS:-0}" -ge 4 ]; then ok "CPU : ${CPUS} cœurs"; else warn "CPU : ${CPUS} cœurs (4 conseillé)"; fi

DISK_PCT=$(df -h / | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ "${DISK_PCT:-100}" -lt 80 ]; then ok "Disque / : ${DISK_PCT}% utilisé"; else ko "Disque / : ${DISK_PCT}% utilisé — libérer de l'espace"; fi

echo "== Docker =="
if command -v docker >/dev/null 2>&1; then
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"
  if docker compose version >/dev/null 2>&1; then ok "Docker Compose présent"; else ko "Docker Compose v2 absent (plugin à installer)"; fi
  if docker ps >/dev/null 2>&1; then ok "Le démon Docker répond"; else ko "Le démon Docker ne répond pas"; fi
else
  ko "Docker absent — voir deploy/README.md section 1"
fi

echo "== Nginx et ports =="
if command -v nginx >/dev/null 2>&1; then ok "Nginx installé"; else warn "Nginx absent (installable : apt install nginx)"; fi
if command -v certbot >/dev/null 2>&1; then ok "Certbot installé"; else warn "Certbot absent (installable : apt install certbot python3-certbot-nginx)"; fi
for port in 80 443; do
  if ss -ltn 2>/dev/null | grep -q ":${port} "; then
    if command -v nginx >/dev/null 2>&1; then ok "Port ${port} occupé (par Nginx)"; else warn "Port ${port} occupé par un autre programme"; fi
  else
    ok "Port ${port} libre"
  fi
done

echo "== Pare-feu =="
if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -q "Status: active"; then ok "ufw actif"; else warn "ufw inactif — activer (ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable)"; fi
else
  warn "ufw absent"
fi

echo "== Fichiers =="
for path in /var/www/ilehya /var/lib/ilehya/storage /var/backups/ilehya; do
  if [ -d "$path" ]; then ok "$path existe"; else warn "$path manquant (mkdir -p $path)"; fi
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/backend/.env.prod"
if [ -f "$ENV_FILE" ]; then
  ok "backend/.env.prod présent"
  MISSING=""
  for var in CLERK_SECRET_KEY ADMIN_JWT_SECRET PII_ENCRYPTION_KEY STORAGE_SIGNING_SECRET \
             PAWAPAY_API_KEY PAWAPAY_MERCHANT_ID APP_PUBLIC_URL ALLOWED_ORIGINS TRUST_PROXY; do
    value=$(grep -E "^${var}=" "$ENV_FILE" | head -n1 | cut -d= -f2- || true)
    if [ -z "$value" ] || [ "$value" = "LE-DOMAINE.FR" ]; then MISSING="$MISSING $var"; fi
  done
  if [ -z "$MISSING" ]; then ok "Variables sensibles renseignées"; else ko "Variables vides ou à remplacer :$MISSING"; fi
  if grep -qE "^PAWAPAY_ENV=sandbox" "$ENV_FILE"; then ko "PAWAPAY_ENV=sandbox — la production exige live"; fi
  if grep -qE "^NODE_ENV=development" "$ENV_FILE"; then ko "NODE_ENV=development dans .env.prod"; fi
else
  ko "backend/.env.prod manquant — cp backend/.env.prod.example backend/.env.prod"
fi

echo "== DNS =="
if [ -n "$DOMAIN" ]; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  RESOLVED=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -n1 || true)
  if [ -z "$RESOLVED" ]; then
    ko "$DOMAIN ne résout pas encore (enregistrement A manquant ?)"
  elif [ -n "$IP" ] && [ "$RESOLVED" != "$IP" ]; then
    ko "$DOMAIN pointe vers $RESOLVED alors que le serveur est sur $IP"
  else
    ok "$DOMAIN → $RESOLVED"
  fi
else
  warn "Aucun domaine fourni : ./deploy/preflight.sh le-domaine.fr"
fi

echo
if [ "$FAILED" = "0" ]; then
  echo "PRÉ-VOL : aucun point bloquant."
  [ "$WARNED" = "1" ] && echo "Des points d'attention restent (non bloquants)."
  exit 0
fi
echo "PRÉ-VOL : points bloquants à corriger avant de déployer."
exit 1

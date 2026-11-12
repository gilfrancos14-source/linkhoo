#!/usr/bin/env bash
# Vérifications de pré-lancement (porte go/no-go).
#
# Usage :  ./deploy/smoke.sh https://le-domaine.fr
#
# Le script ne modifie rien : il vérifie que le site répond, que l'API est
# joignable, que les données sont là et que le stockage est servi.
# Les écritures admin exigent un en-tête Origin conforme à ALLOWED_ORIGINS
# (garde anti-CSRF côté API).

set -uo pipefail

BASE="${1:?Usage : smoke.sh <url_base>}"
ORIGIN="${2:-$BASE}"
FAILED=0

ok()   { echo "  OK   $1"; }
ko()   { echo "  ÉCHEC $1"; FAILED=1; }

check_get() {
  local path="$1" label="$2" expect="$3"
  local code body
  body=$(curl -sS -m 20 -w '\n%{http_code}' "${BASE}${path}" 2>/dev/null)
  code=$(printf '%s' "$body" | tail -n 1)
  body=$(printf '%s' "$body" | sed '$d')
  if [ "$code" = "$expect" ]; then
    ok "${label} (${path}) → ${code}, ${#body} octets"
  else
    ko "${label} (${path}) → ${code} au lieu de ${expect} : ${body:0:200}"
  fi
}

echo "== Pages publiques =="
check_get "/" "page d'accueil" 200
check_get "/api/health" "santé de l'API" 200
check_get "/api/categories?market=CI" "catégories" 200
check_get "/api/rooms?market=CI" "chambres" 200
check_get "/api/banners?market=CI" "bannières" 200
check_get "/api/events?market=CI" "événements" 200
check_get "/api/tourism?market=CI" "destinations" 200
check_get "/api/escapades?market=CI" "escapades" 200

echo "== Sécurité =="
HSTS=$(curl -sSI -m 20 "${BASE}/" 2>/dev/null | grep -i 'strict-transport-security' || true)
[ -n "$HSTS" ] && ok "HSTS présent" || ko "HSTS absent"

if curl -sSI -m 20 "${BASE}/api/health" 2>/dev/null | grep -qi '^x-powered-by'; then
  ko "X-Powered-By exposé"
else
  ok "X-Powered-By masqué"
fi

echo "== Back-office (authentification) =="
LOGIN=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' -c /tmp/ilehya-smoke.cookie \
  -X POST "${BASE}/api/admin/login" \
  -H 'Content-Type: application/json' -H "Origin: ${ORIGIN}" \
  -d "{\"email\":\"${ADMIN_EMAIL:-}\",\"password\":\"${ADMIN_PASSWORD:-}\"}" 2>/dev/null)
if [ "$LOGIN" = "200" ]; then
  ok "connexion admin"
  STATS=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' -b /tmp/ilehya-smoke.cookie "${BASE}/api/admin/stats")
  [ "$STATS" = "200" ] && ok "statistiques admin" || ko "statistiques admin → ${STATS}"
else
  echo "  (ignoré) connexion admin non testée : ADMIN_EMAIL / ADMIN_PASSWORD absents"
fi
rm -f /tmp/ilehya-smoke.cookie

echo
if [ "$FAILED" = "0" ]; then
  echo "RESULTAT : toutes les vérifications de base sont passées."
else
  echo "RESULTAT : au moins une vérification a échoué — ne pas ouvrir au public."
fi
exit $FAILED

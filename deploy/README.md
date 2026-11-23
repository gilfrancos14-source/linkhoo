# Déploiement Ilehya — VPS LWS (4 vCPU / 8 Go, Ubuntu 24.04 LTS)

Pile cible : **PostgreSQL 16 + API Node (Docker) + Nginx (hôte) + Certbot**.
Fichiers : disque local (`/var/lib/ilehya/storage`), photos servies par Nginx,
documents de vérification servis par l'API via URLs signées.

---

## 1. Préparation du serveur (une fois)

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban nginx certbot python3-certbot-nginx

# Compte administratif + clé SSH (on coupe le mot de passe root)
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# Pare-feu : SSH, HTTP, HTTPS seulement
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable

# Docker (paquet officiel Ubuntu)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy

# Arborescence applicative
mkdir -p /var/www/ilehya /var/lib/ilehya/storage/images /var/lib/ilehya/storage/verification-docs \
         /var/backups/ilehya /opt/ilehya
# Cache Nginx des réponses API (www-data doit pouvoir y écrire)
mkdir -p /var/cache/nginx/ilehya_api
chown -R www-data:www-data /var/cache/nginx/ilehya_api
chown -R deploy:deploy /var/lib/ilehya /var/www/ilehya /opt/ilehya
```

## 2. Domaine et DNS

- Enregistrements `A` : `@` et `www` → IP du VPS.
- TTL **300 s** avant la bascule (propagation rapide).
- TTL remonté à 3600 s après la bascule.

## 3. Déploiement

```bash
cd /opt/ilehya
git clone <url-du-depot> .

# Fichier d'environnement de production (modèle fourni)
cp backend/.env.prod.example backend/.env.prod
nano backend/.env.prod      # secrets, clés Clerk/pawaPay, domaine, ALLOWED_ORIGINS…

# Frontend
cd frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/ilehya/ && cd ..

# Images, base, Redis, migrations et redémarrage — en une commande
./deploy/deploy.sh
```

`deploy/deploy.sh` enchaîne : construction de l'image → migrations → redémarrage
→ vérification de `/api/health`. Il est idempotent : le relancer est sans
risque, et une migration qui échoue laisse la version précédente en ligne.

### Architecture : 4 instances de l'API sur un seul serveur

La pile tourne **4 instances de l'API** (`api1`…`api4`, ports 3001–3004 en
local) derrière Nginx (`upstream ilehya_api`, répartition `least_conn`). Cela
utilise les 4 cœurs du VPS au lieu d'un seul, sans coût supplémentaire.

Deux mécanismes évitent les doublons entre instances :
- **Redis local** (`REDIS_URL=redis://redis:6379`, injecté par le compose) :
  compteurs de rate-limit **partagés** entre les 4 instances ;
- **Élection du leader** (`utils/leaderElection.ts`) : un seul processus
  exécute les jobs périodiques (paiements, contact, expiration). Les autres
  instances attendent et prennent le relais si le leader tombe.

Sans `REDIS_URL` (dev mono-instance), on retombe sur le comportement
historique : compteurs en mémoire, une instance = leader.

### Cache des réponses API publiques

Nginx met en cache pour **30 secondes** les GET publics et non personnalisés :
`/api/health`, `/api/categories`, `/api/events`, `/api/tourism`,
`/api/escapades`, `/api/banners`, `/api/rooms` (liste/filtres/détail) et
`/api/reviews` (liste/featured).

Tout le reste (auth, admin, réservations, notifications, `/api/rooms/mine`,
gérants, payouts, upload…) est **exclu par défaut** via la map `$api_no_cache`
→ aucun risque de servir des données personnelles à un autre utilisateur.

- Clé de cache = URI complète (query string incluse) : chaque combinaison de
  filtres a son propre entrée.
- `proxy_cache_use_stale` : si les 4 instances tombent, Nginx sert la dernière
  version en cache plutôt qu'une 502 (meilleure disponibilité).
- `proxy_cache_lock` : une seule requête en amont par clé (anti-dogpile).

**Compromis** : après modification d'une annonce, le changement peut mettre
jusqu'à 30 s à apparaître sur la fiche publique. C'est le prix du cache — à
ajuster si besoin (directive `proxy_cache_valid 200 30s;`).

> Limite réaliste : une machine 4 vCPU / 8 Go tient ~1 000–3 000 utilisateurs
> simultanés. Les 100 000 simultanés demanderaient plusieurs machines — ce
> n'est pas attainable sur un seul VPS, aussi bien optimisé soit-il.

Pour vérifier l'état des migrations à tout moment :

```bash
docker compose -f docker-compose.prod.yml run --rm api1 node dist/db/migrateCli.js --status
```

## 3 bis. Pré-vol (à lancer juste avant)

```bash
./deploy/preflight.sh linkehoo.com
```

Le script vérifie la RAM, le disque, Docker, Nginx, les ports, le pare-feu, le
DNS, et surtout que `backend/.env.prod` ne contient ni variable vide ni
`PAWAPAY_ENV=sandbox`. Il vérifie aussi que `PAYMENTS_APPLY_EVENTS=true` est
présent (sinon les webhooks pawaPay sont ignorés et la confirmation ne repose
que sur le retour navigateur). Il sort avec 1 si un point est bloquant.

Le CSP de `deploy/nginx/ilehya.conf` autorise le script inline de prefetch par
son hash SHA-256. **Si vous modifiez le `<script>` de `frontend/index.html`,
recalculez le hash** et mettez-le à jour dans la directive `script-src`.

## 3 ter. Compte administrateur et modèle d'images (une fois)

Le déploiement ne crée **pas** de compte admin et ne télécharge **pas** le
modèle d'analyse des photos. À faire juste après le premier `deploy.sh` :

```bash
# Compte superadmin (mot de passe dans backend/.env.prod)
cd /opt/ilehya
ALLOW_SEED=true docker compose -f docker-compose.prod.yml run --rm api1 \
  node dist/seed.js

# Modèle CLIP : préchargé DANS l'image Docker au build (CLIP_CACHE_DIR=/app/clip-model)
# — rien à faire sur le serveur. Ce préchargement manuel ne sert qu'à faire
# tourner le backend hors Docker sur la machine de build.
cd backend && npm run model:preload
```

> `npm run seed` insère aussi les catégories et chambres de démonstration
> (idempotent : un second lancement ne les écrase pas). Mettre `ALLOW_SEED=true`
> est obligatoire en production, sinon le seed refuse de tourner.

## 4. Nginx et TLS

```bash
# Le domaine linkehoo.com est déjà renseigné dans la config fournie.
sudo cp deploy/nginx/ilehya.conf /etc/nginx/sites-available/ilehya
sudo ln -s /etc/nginx/sites-available/ilehya /etc/nginx/sites-enabled/

# Premier certificat : on commence en HTTP, Certbot bascule en HTTPS.
sudo certbot --nginx -d linkehoo.com -d www.linkehoo.com
sudo nginx -t && sudo systemctl reload nginx
```

Puis, dans `backend/.env.prod` :

```
STORAGE_PUBLIC_BASE_URL=https://linkehoo.com/media
STORAGE_SIGNED_BASE_URL=https://linkehoo.com/api/media
```

Et relancer l'API pour qu'elle reprenne les nouvelles URLs :

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate api1 api2 api3 api4
```

## 5. Sauvegardes (cron)

```bash
sudo cp deploy/backup/backup.sh /usr/local/bin/ilehya-backup
sudo chmod +x /usr/local/bin/ilehya-backup
sudo crontab -e
# 0 3 * * * /usr/local/bin/ilehya-backup >> /var/log/ilehya-backup.log 2>&1
```

**Test de restauration obligatoire avant l'ouverture** :

```bash
sudo /usr/local/bin/ilehya-backup /var/backups/ilehya/test-restore
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U ilehya -d ilehya -c "SELECT count(*) FROM rooms;"
sudo deploy/backup/restore.sh /var/backups/ilehya/test-restore
```

## 6. Mise à jour

```bash
cd /opt/ilehya && git pull
cd frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/ilehya/ && cd ..
./deploy/deploy.sh
```

## 7. Rollback

```bash
# Complet : restaure la base ET redémarre l'API
./deploy/rollback.sh /var/backups/ilehya/20261117-020000

# Repli code seul (après un git checkout de la version précédente)
./deploy/rollback.sh --code-only
```

- Base : `deploy/backup/restore.sh <sauvegarde>` puis redémarrage de l'API.
- Code : `git checkout <tag-précédent>` + rebuild (image précédente conservée en local).
- Domaine : TTL bas + ancien enregistrement DNS.

## 8. Check-list go/no-go

Commandes de vérification (les écritures admin exigent un en-tête `Origin`
conforme à `ALLOWED_ORIGINS`, sinon l'API répond 403 — garde anti-CSRF) :

```bash
curl -s https://linkehoo.com/api/health
curl -s -X POST https://linkehoo.com/api/admin/login \
  -H 'Content-Type: application/json' -H "Origin: https://linkehoo.com" \
  -c /tmp/admin.cookie \
  -d '{"email":"...","password":"..."}'
curl -s https://linkehoo.com/api/admin/stats -b /tmp/admin.cookie
```

- [ ] `https://linkehoo.com/api/health` → `{"status":"ok"}`
- [ ] Inscription client, connexion admin, réservation de bout en bout
- [ ] Téléversement d'une photo → visible dans la liste des chambres
- [ ] Paiement pawaPay **live** + callback reçu
- [ ] Remboursement test
- [ ] Sauvegarde + **restauration testée**
- [ ] `docker compose ps` : tous les services `healthy`
- [ ] Espace disque > 30 % libre
- [ ] Tag Git `v1.0.0` créé et poussé (`git tag v1.0.0 && git push origin v1.0.0`)

---

## Notes d'architecture

- **Pas de MinIO** : MinIO n'est plus distribuable (images Docker Hub retirées,
  binaires `dl.min.io` en 410). Le stockage disque est plus simple, plus rapide
  et se sauvegarde par une simple copie de dossier.
- **Pas de Supabase Realtime** : le frontend interroge les listes toutes les
  30 s ; `utils/realtime.ts` est devenu un no-op.
- **RLS désactivée côté base** : l'autorisation est assurée par l'API (Clerk +
  vérifications métier). Le rôle de connexion est propriétaire du schéma.
- **Pilote réversible** : `DB_DRIVER=supabase` permet de revenir au client
  Supabase sans toucher au code (filet de sécurité pendant la bascule).

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

cp backend/.env.example backend/.env.prod
# Renseigner : DATABASE_URL n'est PAS nécessaire ici (compose le définit),
# mais STORAGE_PUBLIC_BASE_URL, STORAGE_SIGNED_BASE_URL, STORAGE_SIGNING_SECRET,
# CLERK_SECRET_KEY, ADMIN_JWT_SECRET, PAWAPAY_*, RESEND_API_KEY,
# PII_ENCRYPTION_KEY, APP_PUBLIC_URL, ALLOWED_ORIGINS, TRUST_PROXY=1

# Frontend
cd frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/ilehya/ && cd ..

# Images et base
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d

# Migrations
docker compose -f docker-compose.prod.yml run --rm api node dist/db/migrateCli.js --yes
docker compose -f docker-compose.prod.yml run --rm api node dist/db/migrateCli.js --status
```

## 4. Nginx et TLS

```bash
sed -i 's/ILEHYA_DOMAIN/le-domaine.fr/g' deploy/nginx/ilehya.conf
sudo cp deploy/nginx/ilehya.conf /etc/nginx/sites-available/ilehya
sudo ln -s /etc/nginx/sites-available/ilehya /etc/nginx/sites-enabled/

# Premier certificat : on commence en HTTP, Certbot bascule en HTTPS.
sudo certbot --nginx -d le-domaine.fr -d www.le-domaine.fr
sudo nginx -t && sudo systemctl reload nginx
```

Puis, dans `backend/.env.prod` :

```
STORAGE_PUBLIC_BASE_URL=https://le-domaine.fr/media
STORAGE_SIGNED_BASE_URL=https://le-domaine.fr/api/media
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
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml run --rm api node dist/db/migrateCli.js --yes
docker compose -f docker-compose.prod.yml up -d
cd frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/ilehya/
```

## 7. Rollback

- Base : `deploy/backup/restore.sh <sauvegarde>` puis `restart api`.
- Code : `git checkout <tag-précédent>` + rebuild (image précédente conservée en local).
- Domaine : TTL bas + ancien enregistrement DNS.

## 8. Check-list go/no-go

Commandes de vérification (les écritures admin exigent un en-tête `Origin`
conforme à `ALLOWED_ORIGINS`, sinon l'API répond 403 — garde anti-CSRF) :

```bash
curl -s https://<domaine>/api/health
curl -s -X POST https://<domaine>/api/admin/login \
  -H 'Content-Type: application/json' -H "Origin: https://<domaine>" \
  -c /tmp/admin.cookie \
  -d '{"email":"...","password":"..."}'
curl -s https://<domaine>/api/admin/stats -b /tmp/admin.cookie
```

- [ ] `https://<domaine>/api/health` → `{"status":"ok"}`
- [ ] Inscription client, connexion admin, réservation de bout en bout
- [ ] Téléversement d'une photo → visible dans la liste des chambres
- [ ] Paiement pawaPay **live** + callback reçu
- [ ] Remboursement test
- [ ] Sauvegarde + **restauration testée**
- [ ] `docker compose ps` : tous les services `healthy`
- [ ] Espace disque > 30 % libre

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

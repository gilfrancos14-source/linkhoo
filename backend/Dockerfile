# Image de production du backend Ilehya.
#
# Multi-stage : les dépendances de développement (TypeScript) ne sont pas
# embarquées dans l'image finale. Base Debian (et non Alpine) : `sharp` et
# `onnxruntime-node` (modèle d'analyse d'images) fournissent des binaires
# précompilés glibc, absents sur musl.
#
# Build :  docker build -t ilehya-backend:1.0.0 backend
# Run    :  docker compose -f docker-compose.prod.yml up -d api

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# curl sert au healthcheck du conteneur.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
# Les migrations SQL sont embarquées : `node dist/db/migrateCli.js` doit
# pouvoir les lire depuis l'image.
COPY supabase ./supabase
# Gabarit HTML du reçu de paiement (lu à l'exécution par src/routes/receipts.ts).
COPY templates ./templates

# Le stockage des fichiers (photos, documents de vérification) est un volume.
RUN mkdir -p /app/storage && chown -R node:node /app/storage
VOLUME ["/app/storage"]

# Le worker CLIP vit dans `scripts/` (hors `src/`, donc non compilé par tsc) :
# sans cette copie, `fork('/app/scripts/clipWorker.mjs')` échoue et TOUS les
# uploads d'images gérant répondent 503 en mode strict.
COPY scripts ./scripts

# Le modèle est préchargé dans l'image : aucune dépendance réseau au runtime,
# aucun volume à initialiser, pas de 503 pendant le premier téléversement.
ARG CLIP_MODEL_ID=Xenova/clip-vit-base-patch32
ARG CLIP_DTYPE=q8
ENV CLIP_CACHE_DIR=/app/clip-model
RUN mkdir -p /app/clip-model \
 && CLIP_MODEL_ID="${CLIP_MODEL_ID}" \
    CLIP_DTYPE="${CLIP_DTYPE}" \
    CLIP_CACHE_DIR=/app/clip-model \
    node scripts/modelPreload.mjs \
 && chown -R node:node /app/clip-model

# Modèles OPUS-MT pour la traduction asynchrone des contenus (fr → en/es et
# retour pour la détection des traductions à revoir). Préchargés au build :
# aucun téléchargement réseau au démarrage du worker.
ENV I18N_CACHE_DIR=/app/i18n-model
RUN mkdir -p /app/i18n-model \
 && I18N_CACHE_DIR=/app/i18n-model node scripts/i18nModelPreload.mjs \
 && chown -R node:node /app/i18n-model

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT:-3001}/api/health || exit 1

CMD ["node", "dist/index.js"]

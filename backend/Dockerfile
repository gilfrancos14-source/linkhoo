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

# Le stockage des fichiers (photos, documents de vérification) est un volume.
RUN mkdir -p /app/storage && chown -R node:node /app/storage
VOLUME ["/app/storage"]

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT:-3001}/api/health || exit 1

CMD ["node", "dist/index.js"]

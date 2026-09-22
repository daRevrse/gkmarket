# syntax=docker/dockerfile:1

# ---- deps : toutes les dépendances (dev incluses : build + drizzle-kit) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
# Binaires GPU d'onnxruntime inutiles : l'inférence CLIP tourne sur le CPU.
RUN rm -f node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_cuda.so node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime_providers_tensorrt.so

# ---- builder : build Next.js en sortie standalone ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variables publiques Firebase : inlinées dans le bundle client AU BUILD.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
# Modèle CLIP embarqué : la production ne télécharge rien à l'exécution.
RUN node scripts/fetch-clip-model.mjs
RUN npm run build

# ---- migrator : applique les migrations Drizzle (one-shot) ----
FROM node:22-bookworm-slim AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts tsconfig.json ./
COPY drizzle ./drizzle
COPY src ./src
CMD ["npx", "drizzle-kit", "migrate"]

# ---- runner : image finale minimale ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Polices pour le rendu SVG (filigrane des médias) : sans fontconfig ni
# police installée, librsvg dessine des carrés à la place du texte.
RUN apt-get update && apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core  && rm -rf /var/lib/apt/lists/*
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Encodeur visuel (recherche par image) : ~86 Mo, lu au premier usage.
COPY --from=builder --chown=nextjs:nodejs /app/models ./models
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

# apps/backend/Dockerfile
# Etape 1 : Installation et Prisma
# Image de base tirée du miroir AWS ECR Public (mirroir officiel de Docker Hub) :
# evite les timeouts/rate-limits aleatoires de registry-1.docker.io qui font
# echouer le build CI ("dial tcp ... i/o timeout" sur node:20-alpine).
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

# FIX PRISMA : Installation d'OpenSSL
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
COPY . .
RUN npm install
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma

# Etape 2 : Runtime
FROM public.ecr.aws/docker/library/node:20-alpine AS runner
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
# Stats de contributions git (JSON) calculées par le CI au build : la prod n'a
# ni `.git` ni binaire `git`, donc l'endpoint /contributors/stats lit cette valeur.
ARG CONTRIBUTOR_STATS="{}"
ENV CONTRIBUTOR_STATS=${CONTRIBUTOR_STATS}
LABEL commit="${GIT_COMMIT}" build_date="${BUILD_DATE}" service="backend"

# Durcissement : on met à jour les paquets Alpine (CVE OS : openssl, libxml2, …)
# puis on installe ce qu'il faut à l'exécution (OpenSSL requis par Prisma).
RUN apk upgrade --no-cache && apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copie sélective pour économiser le disque
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/backend ./apps/backend

# Durcissement : ne pas tourner en root. Le user `node` (présent dans l'image)
# exécute l'app et les migrations ; le cache npm/npx est redirigé vers /tmp
# (writable). En cas de RCE applicative, l'attaquant n'est pas root dans le
# conteneur — défense en profondeur.
ENV NPM_CONFIG_CACHE=/tmp/.npm
RUN chown -R node:node /app
USER node

WORKDIR /app/apps/backend
EXPOSE 3000

# Auto-migrate puis démarrer
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]

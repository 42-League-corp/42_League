# apps/backend/Dockerfile
# Etape 1 : Installation et Prisma
FROM node:20-alpine AS builder

# FIX PRISMA : Installation d'OpenSSL
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app
COPY . .
RUN npm install
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma

# Etape 2 : Runtime
FROM node:20-alpine AS runner
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
LABEL commit="${GIT_COMMIT}" build_date="${BUILD_DATE}" service="backend"

# FIX PRISMA : OpenSSL est aussi requis à l'exécution
RUN apk add --no-cache openssl libc6-compat

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

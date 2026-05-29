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

WORKDIR /app/apps/backend
EXPOSE 3000

# Auto-migrate puis démarrer
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]

# apps/web/Dockerfile
# Etape 1 : Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm install

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown

# Injection de l'URL de l'API
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build -w @42-league/web

# Etape 2 : Production (Nginx)
FROM nginx:alpine AS runner
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
LABEL commit="${GIT_COMMIT}" build_date="${BUILD_DATE}" service="frontend"
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# FIX NGINX : Rediriger toutes les requêtes (SPA fallback) vers index.html
RUN echo "server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

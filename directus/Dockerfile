# ============================================================
# ENTERAR.ME — Directus 11 custom image
# Base: directus/directus:11 (Node 20)
# Añade: extensiones custom + dependencias npm
# ============================================================
FROM directus/directus:11

# Metadatos
LABEL org.opencontainers.image.title="ENTERAR.ME Directus"
LABEL org.opencontainers.image.description="Backend headless CMS + API for ENTERAR.ME SaaS multitenant"
LABEL org.opencontainers.image.source="https://github.com/enterarme/enterarme"

# Directorio de trabajo dentro del contenedor
WORKDIR /directus

# Copy package.json primero para aprovechar cache de Docker
COPY package.json package-lock.json* ./

# Instalar dependencias (producción) — el directorio extensions se monta/copiará después
RUN npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund

# Copiar extensiones (endpoints, hooks, interfaces...)
COPY extensions ./extensions

# Copiar snapshots, migrations, flows y seeds (recursos estáticos)
COPY snapshots ./snapshots
COPY migrations ./migrations
COPY flows ./flows
COPY seed ./seed

# El usuario por defecto de la imagen oficial ya es 'node' (UID 1000)
# Aseguramos permisos
USER root
RUN chown -R node:node /directus
USER node

# Exponer puerto de Directus
EXPOSE 8055

# El entrypoint y cmd ya están definidos en la imagen base
# (directus start) — no hace falta sobreescribirlos.

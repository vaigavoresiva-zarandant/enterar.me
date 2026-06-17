# ============================================================
# ENTERAR.ME — AI Service Dockerfile
# Multi-stage: build con node:20-alpine, runtime node:20-alpine
# ============================================================

# ---------- Stage 1: build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependencias primero (mejor cache)
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copia fuentes y compila
COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------- Stage 2: runtime ----------
FROM node:20-alpine AS runtime

WORKDIR /app

# Sólo dependencias de producción
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

# Trae el compilado
COPY --from=builder /app/dist ./dist

# Usuario no-root
RUN addgroup -S app && adduser -S app -G app
USER app

ENV NODE_ENV=production
ENV PORT=3030

EXPOSE 3030

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3030)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

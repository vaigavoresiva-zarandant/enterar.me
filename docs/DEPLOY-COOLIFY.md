# Despliegue en Coolify — ENTERAR.ME

Guía paso a paso para desplegar ENTERAR.ME en un VPS con **Coolify**.

> Coolify es un PaaS self-hosted (estilo Heroku) que gestiona contenedores
> Docker, dominios, Let's Encrypt y volúmenes. Necesitamos un VPS con al
> menos 4 vCPU / 8 GB RAM / 80 GB SSD.

---

## 0. Pre-requisitos

- Un **VPS** con Coolify instalado (https://coolify.io/docs/installation).
- Un **dominio** `enterarme.me` (o el tld que uses) apuntando a la IP del VPS.
  - Registro de DNS tipo A para `enterarme.me`, `www`, `coolify`, `api`, `ai`,
    `admin`, `app` y wildcard `*.app` → IP del VPS.
- Una cuenta en **Railway** (https://railway.app) para Ollama
  (ver `DEPLOY-OLLAMA-RAILWAY.md`).
- Repositorio GitHub con el código de ENTERAR.ME.
- Docker instalado localmente para pruebas (opcional).

---

## 1. Crear proyecto en Coolify "ENTERAR.ME"

1. Entra en el panel de Coolify (típicamente `https://coolify.enterarme.me`).
2. **Projects → New Project** → nombre: `ENTERAR.ME`.
3. Dentro del proyecto crea un entorno (`Production`).

A partir de aquí añadiremos 5 servicios: 1 Postgres + 4 applications.

---

## 2. Desplegar Postgres como servicio gestionado

1. **Resources → Add → Service** → busca `PostgreSQL`.
2. Nombre del servicio: `enterarme-postgres`.
3. Configuración:
   - **PostgreSQL Username**: `enterarme` (o el de `.env`).
   - **PostgreSQL Password**: password seguro (guárdalo en gestor de contraseñas).
   - **PostgreSQL Database**: `enterarme`.
   - **PostgreSQL Version**: `16`.
4. Volúmenes: Coolify monta automáticamente `/var/lib/postgresql/data`.
5. **Deploy**.
6. Una vez levantado, en la pestaña **Environment Variables** copia los valores
   de `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, y la conexión interna
   (host `enterarme-postgres`, port `5432`).

> El VPS debe tener **al menos 4 GB RAM** libres para Postgres. Recomendado
> `shared_buffers = 1GB` y `work_mem = 32MB` en `postgresql.conf`.

### 2.1 Conectar al Postgres y aplicar extensiones

```bash
# Desde el VPS, vía coolify service exec o psql client:
psql "postgresql://enterarme:<password>@enterarme-postgres:5432/enterarme" \
  -c 'CREATE EXTENSION IF NOT EXISTS "pgcrypto";'
psql "postgresql://enterarme:<password>@enterarme-postgres:5432/enterarme" \
  -c 'CREATE EXTENSION IF NOT EXISTS "vector";'
psql "postgresql://enterarme:<password>@enterarme-postgres:5432/enterarme" \
  -c 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";'
```

Estas extensiones las crea también la migración `001_initial_schema.sql`,
pero conviene dejarlas instaladas antes del primer arranque de Directus.

---

## 3. Desplegar Directus

### 3.1 Crear la Application

1. **Resources → Add → Application** → **Public Repository** (o Private) →
   selecciona el repo `enterarme/enterarme`.
2. Nombre: `enterarme-directus`.
3. **Build Pack**: `Dockerfile`.
4. **Dockerfile Location**: `directus/Dockerfile` ( Coolify leerá este path dentro del repo).
5. **Port**: `8055`.
6. **Health Check Path**: `/server/health`.
7. **Domain**: `api.enterarme.me` (Coolify gestionará Let's Encrypt automáticamente).

### 3.2 Volúmenes

Añadir dos volúmenes persistentes:

| Mount path            | Uso                                       |
|-----------------------|-------------------------------------------|
| `/directus/uploads`   | Archivos subidos por Directus (avatars, attachments). |
| `/directus/extensions`| Extensiones compiladas (endpoints, hooks).|

> Si el Dockerfile ya copia las extensiones al construir la imagen, el volumen
> de extensions puede omitirse. Pero si quieres editar extensiones sin rebuild,
> monta el volumen y copia los archivos manualmente.

### 3.3 Variables de entorno

En **Environment Variables** del servicio, define (valores de `.env.example`):

```env
# Comunes
NODE_ENV=production
TZ=Europe/Madrid

# Postgres (usa los valores internos de Coolify)
DB_CLIENT=pg
DB_HOST=enterarme-postgres
DB_PORT=5432
DB_USER=enterarme
DB_PASSWORD=<password-postgres>
DB_DATABASE=enterarme

# Directus
KEY=<genera-32-chars-hex>
SECRET=<genera-32-chars-hex>
ADMIN_EMAIL=admin@enterarme.me
ADMIN_PASSWORD=<password-seguro-admin>
PUBLIC_URL=https://api.enterarme.me
CORS_ENABLED=true
CORS_ORIGIN=https://admin.enterarme.me,https://app.enterarme.me,https://*.app.enterarme.me
WEBSOCKETS_ENABLED=true

# Service token (compartido con frontends y AI service)
DIRECTUS_SERVICE_TOKEN=<genera-token-largo>

# AI Service (para el endpoint /agent/chat)
AI_SERVICE_URL=http://enterarme-ai:3030

# Frontend token (para lecturas públicas desde frontends)
DIRECTUS_FRONTEND_TOKEN=<genera-otro-token>
```

> Coolify crea automáticamente una red interna entre aplicaciones del mismo
> proyecto, por lo que Directus puede llamar a `http://enterarme-ai:3030`.
> El hostname es el nombre del servicio de Coolify.

### 3.4 Deploy y verificación

1. **Deploy**. Coolify hace el build (~3–5 min) y levanta el contenedor.
2. Comprueba el log: deberías ver `Directus started at http://0.0.0.0:8055`.
3. Smoke test:

```bash
curl https://api.enterarme.me/server/health
# → { "status": "ok" }

curl -X POST https://api.enterarme.me/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enterarme.me","password":"<tu-password>"}'
# → { "data": { "access_token": "..." } }
```

---

## 4. Desplegar AI Service

### 4.1 Crear la Application

1. **Resources → Add → Application** → repo `enterarme/enterarme`.
2. Nombre: `enterarme-ai`.
3. **Build Pack**: `Dockerfile`.
4. **Dockerfile Location**: `ai/Dockerfile`.
5. **Port**: `3030`.
6. **Health Check Path**: `/health`.
7. **Domain**: `ai.enterarme.me`.

### 4.2 Variables de entorno

```env
NODE_ENV=production
PORT=3030
TZ=Europe/Madrid

# Postgres (mismo que Directus)
DATABASE_URL=postgresql://enterarme:<password>@enterarme-postgres:5432/enterarme
PG_POOL_MAX=10

# Ollama (Railway — ver DEPLOY-OLLAMA-RAILWAY.md)
OLLAMA_HOST=https://<tu-proxy-caddy>.up.railway.app
OLLAMA_API_KEY=<bearer-secret-del-proxy>
OLLAMA_MODEL=enterarme-agent
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_TIMEOUT_MS=120000
OLLAMA_MAX_RETRIES=3
OLLAMA_EMBED_DIM=768

# Directus
DIRECTUS_URL=http://enterarme-directus:8055
DIRECTUS_SERVICE_TOKEN=<mismo-que-directus>

# JWT (compartido con Directus: usa el valor de SECRET)
JWT_SECRET=<mismo-SECRET-que-Directus>
JWT_ISSUER=enterarme

# CORS
CORS_ORIGINS=https://admin.enterarme.me,https://app.enterarme.me

# Orchestrator
AGENT_MAX_TOOL_ITERATIONS=5
RAG_TOP_K=5
```

### 4.3 Deploy y verificación

```bash
# Healthcheck (sin auth, /health es público)
curl https://ai.enterarme.me/health
# → { "status": "ok", "service": "enterarme-ai", "checks": { "db": true, "ollama": true }, "ollama_model": "enterarme-agent" }
# Si "status": "degraded" → revisa OLLAMA_HOST / OLLAMA_API_KEY y la conexión a Postgres
```

---

## 5. Desplegar Super Admin

### 5.1 Crear la Application

1. **Resources → Add → Application** → repo `enterarme/enterarme`.
2. Nombre: `enterarme-super-admin`.
3. **Build Pack**: `Dockerfile`.
4. **Dockerfile Location**: `apps/super-admin/Dockerfile`.
5. **Port**: `3000`.
6. **Health Check Path**: `/api/kpis`.
7. **Domain**: `admin.enterarme.me`.

### 5.2 Variables de entorno

```env
NODE_ENV=production
PORT=3000
TZ=Europe/Madrid

NEXT_PUBLIC_DIRECTUS_URL=https://api.enterarme.me
NEXT_PUBLIC_AI_URL=https://ai.enterarme.me

DIRECTUS_SERVICE_TOKEN=<mismo-que-directus>
DIRECTUS_FRONTEND_TOKEN=<mismo-que-directus>

NEXTAUTH_URL=https://admin.enterarme.me
NEXTAUTH_SECRET=<genera-secret-nextauth-superadmin>
```

> `NEXT_PUBLIC_*` se compilan en build. Para que el panel apunte al backend
> correcto, asegúrate de que las variables están definidas en Coolify **antes**
> del primer build. Si las cambias, hay que redeployar.

### 5.3 Deploy y verificación

```bash
curl -I https://admin.enterarme.me/login
# → HTTP/2 200
```

Entrar en `https://admin.enterarme.me/login` y loguear con `admin@enterarme.me`.

---

## 6. Desplegar Tenant Admin

### 6.1 Crear la Application

1. **Resources → Add → Application** → repo `enterarme/enterarme`.
2. Nombre: `enterarme-tenant-admin`.
3. **Build Pack**: `Dockerfile`.
4. **Dockerfile Location**: `apps/tenant-admin/Dockerfile`.
5. **Port**: `3000`.
6. **Health Check Path**: `/login` (o `/api/health` si lo añades).
7. **Domains**:
   - Principal: `app.enterarme.me`.
   - Wildcard: `*.app.enterarme.me` (Coolify lo soporta con Let's Encrypt
     vía DNS-01 challenge — ver sección 7).

### 6.2 Variables de entorno

```env
NODE_ENV=production
PORT=3000
TZ=Europe/Madrid

NEXT_PUBLIC_DIRECTUS_URL=https://api.enterarme.me
NEXT_PUBLIC_AI_URL=https://ai.enterarme.me

DIRECTUS_SERVICE_TOKEN=<mismo-que-directus>
DIRECTUS_FRONTEND_TOKEN=<mismo-que-directus>

TENANT_AUTH_URL=https://app.enterarme.me
TENANT_AUTH_SECRET=<genera-secret-nextauth-tenant>

TENANT_RESOLVER=subdomain
```

### 6.3 Wildcard TLS

Coolify usa Let's Encrypt. Para `*.app.enterarme.me` necesitas **DNS-01
challenge** (no HTTP-01, que no soporta wildcards):

1. En Coolify → **Settings → DNS Provider** → configura tu provider
   (Cloudflare, DigitalOcean, Route53…).
2. En el servicio `enterarme-tenant-admin` → **Domains → Add Domain**:
   - `*.app.enterarme.me` → cert type: `letsencrypt-wildcard`.
   - Coolify creará los registros TXT `_acme-challenge` automáticamente.

Alternativa más simple: desplegar el tenant-admin por **path** en vez de
subdominio (`app.enterarme.me/?tenant=miempresa`). El middleware de
`apps/tenant-admin/middleware.ts` lo soporta con `?tenant=slug`.

### 6.4 Deploy y verificación

```bash
# Acceso principal (sin tenant en subdominio → redirect a /login)
curl -I https://app.enterarme.me/
# → HTTP/2 307  Location: /login

# Acceso por subdominio (miempresa.app.enterarme.me → /login?tenant=miempresa)
curl -I https://miempresa.app.enterarme.me/
# → HTTP/2 307  Location: /login?tenant=miempresa
```

---

## 7. Configurar DNS

En tu proveedor de dominio, crea los siguientes registros:

| Tipo  | Nombre                 | Valor                | TTL  |
|-------|------------------------|----------------------|------|
| A     | `enterarme.me`         | `<IP-VPS>`           | 3600 |
| A     | `www`                  | `<IP-VPS>`           | 3600 |
| A     | `coolify`              | `<IP-VPS>`           | 3600 |
| A     | `api`                  | `<IP-VPS>`           | 3600 |
| A     | `ai`                   | `<IP-VPS>`           | 3600 |
| A     | `admin`                | `<IP-VPS>`           | 3600 |
| A     | `app`                  | `<IP-VPS>`           | 3600 |
| CNAME | `*.app`                | `app.enterarme.me`   | 3600 |

> Si usas Cloudflare, pon el proxy naranja desactivado (DNS only) para
> `api`, `ai` y `*.app` durante la emisión del certificado. Una vez
> emitido, puedes activar el proxy.

---

## 8. Primer arranque (schema + seeds)

Una vez Directus está corriendo y responde `/server/health`, aplicar el
esquema y los seeds.

### 8.1 Aplicar el snapshot de Directus

Desde dentro del contenedor Directus (Coolify → servicio `enterarme-directus`
→ **Exec** → entra en la shell):

```bash
# Snapshot (colecciones, campos, relaciones, permisos)
npx directus schema apply ./snapshots/schema-snapshot.yaml

# Migración SQL equivalente (pgvector, índices, triggers) — recomendada
psql "$DATABASE_URL" -f ./migrations/001_initial_schema.sql
```

> Ambos son compatibles: el snapshot crea las colecciones y permisos, el SQL
> añade pgvector + índices ivfflat/GIN + triggers que Directus no gestiona.
> Aplicar en este orden.

### 8.2 Importar seeds

El repo incluye un script orquestador `scripts/init-directus.sh` que hace
todo en orden (wait health → login → schema apply → 3 seeds → token
servicio → resumen):

```bash
# Apunta a tu Directus ya desplegado
export DIRECTUS_URL=https://api.enterarme.me
export DIRECTUS_ADMIN_EMAIL=admin@enterarme.me
export DIRECTUS_ADMIN_PASSWORD=<tu-password>
bash scripts/init-directus.sh
```

Si prefieres hacerlo manualmente:

```bash
# Roles fijos + admin@enterarme.me (si no lo creó el entrypoint)
npx directus seed:import -s ./seed/superadmin.json

# Planes Starter / Pro / Enterprise
npx directus seed:import -s ./seed/planes.json

# Sectores + plantillas del marketplace
npx directus seed:import -s ./seed/marketplace-sectores.json
# o con el script wrapper:
bash scripts/seed-marketplace.sh
```

### 8.3 Verificación

```bash
# Planes
curl https://api.enterarme.me/items/planes \
  -H "Authorization: Bearer $DIRECTUS_SERVICE_TOKEN"
# → 3 planes: Starter, Pro, Enterprise

# Sectores
curl https://api.enterarme.me/items/sectores_mercado \
  -H "Authorization: Bearer $DIRECTUS_SERVICE_TOKEN"
# → 4 sectores

# Plantillas
curl https://api.enterarme.me/items/plantillas_mercado \
  -H "Authorization: Bearer $DIRECTUS_SERVICE_TOKEN"
# → 11 plantillas
```

---

## 9. Crear el primer tenant

Desde el panel super-admin (`https://admin.enterarme.me`):

1. Login con `admin@enterarme.me`.
2. **Tenants → Nuevo**.
3. Rellena: nombre, slug, plan (Pro), email del admin del tenant, password,
   sector (Limpieza profesional).
4. El frontend llama a `POST /api/tenants/[id]/onboarding` (BFF) que a su
   vez llama a `POST /onboarding/tenant` de Directus con el service token.
5. Tras 201 Created, el tenant aparece en la lista con KPIs (1 ubicación,
   1 usuario externo, 1 usuario interno, 1 material, 2 tareas).

**curl equivalente**:

```bash
curl -X POST https://api.enterarme.me/onboarding/tenant \
  -H "Authorization: Bearer $DIRECTUS_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Acme Limpiezas S.L.",
    "slug": "acme-limpiezas",
    "plan_id": "22222222-2000-2000-2000-000000000002",
    "admin_email": "admin@acme.es",
    "admin_password": "Acme2024!",
    "sector_id": "dddd0000-0000-0000-0000-000000000004"
  }'
```

O con el script wrapper `scripts/create-tenant.sh` (resuelve el `plan_id`
por nombre del plan y valida los argumentos):

```bash
export DIRECTUS_URL=https://api.enterarme.me
export DIRECTUS_SERVICE_TOKEN=<tu-token>
bash scripts/create-tenant.sh \
  --nombre "Acme Limpiezas S.L." \
  --slug acme-limpiezas \
  --plan Pro \
  --email admin@acme.es \
  --password Acme2024! \
  --sector limpieza-profesional
```

Ver `docs/ONBOARDING.md` para el detalle completo.

---

## 10. Smoke test

Una vez creado el primer tenant, verificar el flujo E2E:

### 10.1 Login en tenant-admin

1. Visita `https://acme-limpiezas.app.enterarme.me/login`.
2. El campo `tenant` debe auto-rellenarse con `acme-limpiezas`.
3. Loguea con `admin@acme.es` / `Acme2024!`.
4. Debe cargar el dashboard con las 2 tareas del onboarding visibles.

### 10.2 Crear una ubicación

1. **Ubicaciones → Nueva**.
2. Nombre: `Cliente XYZ`, tipo: `local`, dirección: `Calle Mayor 1`.
3. Guardar → debe aparecer en la lista.

### 10.3 Crear una tarea

1. **Tareas → Nueva**.
2. Ubicación: `Cliente XYZ`. Usuario externo: `Acme Limpiezas S.L.` (la empresa propia).
3. Título: `Limpieza semanal`. Prioridad: `media`.
4. Guardar → debe aparecer en el Kanban (columna `pendiente`).
5. Verificar trazabilidad: entrar al detalle de la tarea → timeline con
   evento `nota` (`tarea_creada`).

### 10.4 Probar el agente IA

1. **Agente → Nueva conversación**.
2. Mensaje: *"¿Qué tareas tengo pendientes?"*
3. El agente debe responder (latencia 5–30s la primera vez por cold start de Ollama).
4. Mensaje: *"Crea una ubicación llamada Cliente ABC de tipo local en la
   calle Sol 5"*. Debe invocar la skill `crear_ubicacion` y devolver el ID.

### 10.5 Healthchecks

```bash
curl https://api.enterarme.me/server/health      # → ok
curl https://ai.enterarme.me/health              # → ok (con db:true, ollama:true)
curl -I https://admin.enterarme.me/api/kpis      # → 200 (con auth) o 401 (sin)
curl -I https://app.enterarme.me/login           # → 200
```

---

## 11. Let's Encrypt

Coolify lo gestiona automáticamente:

- Cada dominio añadido a un servicio dispara la emisión del certificado vía
  **HTTP-01** por defecto.
- Para el wildcard `*.app.enterarme.me`, hay que cambiar a **DNS-01** (ver
  sección 6.3).
- Renovación automática a los 30 días de expirar.
- Si el challenge falla (DNS no propagado), Coolify reintenta cada hora.

**Troubleshooting**:

| Síntoma                          | Causa probable                          | Fix                                          |
|----------------------------------|-----------------------------------------|----------------------------------------------|
| Certificado pending > 10 min     | DNS no apunta al VPS                    | Verifica `dig api.enterarme.me`              |
| Wildcard falla                   | Falta configurar DNS provider en Coolify| Settings → DNS Provider → Cloudflare tokens  |
| `ERR_SSL_PROTOCOL_ERROR`         | Let's Encrypt rate limit (5 certs/día)  | Esperar 24h o usar staging                   |

---

## 12. WebSocket

Directus necesita WebSocket para tiempo real (suscripciones a colecciones).
El Dockerfile y la imagen oficial ya lo soportan, solo hay que asegurarse
de que:

1. `WEBSOCKETS_ENABLED=true` (definido en variables de entorno).
2. Coolify no bloquea el upgrade HTTP→WS (por defecto lo permite vía su
   proxy Traefik interno).
3. El navegador del cliente no está detrás de un proxy que bloquee WS
   (poco frecuente).

Smoke test desde la consola del navegador:

```javascript
const ws = new WebSocket("wss://api.enterarme.me/websocket");
ws.onopen = () => console.log("WS abierto");
ws.onmessage = (e) => console.log("MSG", e.data);
ws.send(JSON.stringify({ type: "items", collection: "tareas", action: "subscribe" }));
```

---

## 13. Backups Postgres

Coolify permite **Scheduled Tasks** y **Volume Backups**. Recomendado:

### 13.1 Backup lógico diario (`pg_dump`)

Añadir un **Scheduled Task** en el servicio Postgres (Coolify →
**Tasks → Add**):

```bash
# Backup diario a las 03:00 UTC, retención 14 días
mkdir -p /backups
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U $POSTGRES_USER -d $POSTGRES_DB -F c -f /backups/enterarme_$DATE.dump
find /backups -name "*.dump" -mtime +14 -delete
```

### 13.2 Snapshot de volumen Coolify

Coolify → **Volumes → Backups** → activar backup del volumen de Postgres
con frecuencia diaria y retención 30 días. Subir a S3-compatible (Backblaze
B2, Cloudflare R2).

### 13.3 Restauración de prueba

Cada mes, restaurar el último backup en un Postgres de staging y verificar
que las queries principales funcionan. Documentar el RTO/RPO real.

---

## 14. Plantillas JSON predefinidas en `coolify/`

El repo incluye plantillas Coolify (formato docker-compose con metadatos
en clave `_coolify`) para cada servicio. Estructura:

```
coolify/
├── README.md            # cómo importar las plantillas + secrets obligatorios
├── postgres.json        # plantilla de PostgreSQL + pgvector
├── directus.json        # plantilla del servicio Directus
├── ai-service.json      # plantilla del AI service
├── super-admin.json     # plantilla del frontend super-admin
└── tenant-admin.json    # plantilla del frontend tenant-admin
```

Cada plantilla define:

- Imagen GHCR (`ghcr.io/<owner>/enterarme-<service>:latest`) — sustituye
  `<owner>` por el owner del repo GitHub propietario.
- Variables de entorno (con placeholders `${VAR}` que Coolify resuelve).
- Volúmenes persistentes.
- Healthcheck (con `node -e` para no requerir curl/wget en alpine).
- `depends_on` entre servicios.
- Labels `coolify.managed=true` y `enterarme.component=<…>`.

### 14.1 Cómo importar las plantillas

**Opción A — Desde GitHub repo (recomendado por `coolify/README.md`)**:

1. Coolify → **+ New Resource** → **Application** → **Public repository**.
2. Selecciona el repo `enterarme` y la rama `main`.
3. **Build Pack**: `Dockerfile`.
4. **Dockerfile Location**: `directus/Dockerfile` / `ai/Dockerfile` /
   `apps/super-admin/Dockerfile` / `apps/tenant-admin/Dockerfile`.
5. **Port**: 8055 / 3030 / 3000 / 3000.
6. **Domains**: el dominio público del servicio.
7. **Environment Variables**: copia las del bloque `environment` de la
   plantilla JSON correspondiente y rellena los `${...}` con tus secrets.
8. **Deploy**.

**Opción B — Desde imagen GHCR ya publicada**:

1. Coolify → **+ New Resource** → **Docker Compose Empty**.
2. Pega el contenido del bloque `services:` de la plantilla JSON como un
   `docker-compose.yml`.
3. Sustituye los `${VAR}` por valores reales o por secrets de Coolify.
4. Configura dominio + Let's Encrypt.
5. **Deploy**.

> Coolify v4 aún no tiene import directo de JSON como `service template`
> desde la UI estable, pero acepta pegar el bloque `services:`. La clave
> `_coolify` son metadatos humanos (no la procesa Coolify).

### 14.2 Secrets obligatorios

Antes de desplegar nada, define estos secrets en Coolify (Project →
Environment Variables, marcados como `secret`):

- `POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_HOST`,
  `POSTGRES_PORT`.
- `DIRECTUS_KEY`, `DIRECTUS_SECRET`, `DIRECTUS_ADMIN_EMAIL`,
  `DIRECTUS_ADMIN_PASSWORD`, `DIRECTUS_PUBLIC_URL`, `DIRECTUS_CORS_ORIGIN`,
  `DIRECTUS_SERVICE_TOKEN`.
- `AI_URL`, `OLLAMA_HOST`, `OLLAMA_API_KEY`, `OLLAMA_MODEL`,
  `OLLAMA_EMBED_MODEL`.
- `NEXTAUTH_SECRET` (super-admin), `TENANT_AUTH_SECRET` (tenant-admin).
- `TZ` (default `Europe/Madrid`).

Ver `coolify/README.md` para la lista completa y los valores por defecto.

---

## 15. Orden de arranque recomendado

Si reinicias el VPS completo, los servicios deben arrancar en este orden
(Coolify gestiona `depends_on` automáticamente, pero conviene conocerlo):

1. **Postgres** (debe estar healthy antes que el resto).
2. **Directus** (espera a Postgres).
3. **AI Service** (espera a Postgres; Ollama en Railway está siempre on).
4. **Super Admin** y **Tenant Admin** (pueden arrancar en paralelo; no
   bloquean si Directus aún no responde, pero muestran error de conexión).

---

## 16. Notas finales

- **Logging**: Coolify captura stdout/stderr de cada contenedor. Búscalos
  en **Logs** del servicio. Para logs estructurados (JSON), el AI Service
  usa `pino`.
- **Updates**: para actualizar el código, push a `main` en GitHub y luego
  **Deploy** en Coolify (o activar auto-deploy on push).
- **Rollback**: Coolify mantiene las últimas 3 imágenes. **Deploy →
  Rollback** para volver a la anterior.
- **Monitoring**: integrar con Uptime Kuma (separado) para monitorizar
  `/health` de cada servicio.

---

## 17. Referencias

- `directus/Dockerfile` — imagen de Directus.
- `ai/Dockerfile` — imagen del AI service.
- `apps/super-admin/Dockerfile` — imagen del super-admin.
- `apps/tenant-admin/Dockerfile` — imagen del tenant-admin.
- `.env.example` — todas las variables documentadas.
- `coolify/README.md` + 5 plantillas JSON — plantillas de despliegue.
- `scripts/init-directus.sh` — orquestador de schema + seeds + token.
- `scripts/create-tenant.sh` — wrapper del endpoint de onboarding.
- `scripts/seed-marketplace.sh` — wrapper del seed de marketplace.
- `scripts/create-superadmin.sh` — alta del primer admin.
- `scripts/dev-up.sh` y `scripts/dev-down.sh` — levantar/bajar entorno local.
- `docs/ONBOARDING.md` — alta de tenants.
- `docs/DEPLOY-OLLAMA-RAILWAY.md` — despliegue de Ollama.
- `docs/ARQUITECTURA.md` — visión general del stack.
- Coolify docs: https://coolify.io/docs

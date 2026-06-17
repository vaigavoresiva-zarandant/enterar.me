# Coolify — Plantillas de despliegue ENTERAR.ME

Este directorio contiene **plantillas JSON** (formato docker-compose con metadatos en `_coolify`) para cada servicio de ENTERAR.ME. Sirven como **referencia rápida** de configuración (imagen, puertos, variables, volúmenes, healthcheck, dependencias) y pueden importarse manualmente en Coolify.

> **Recomendación principal (Coolify v4):** lo más fácil es crear **Applications** apuntando al repo GitHub y seleccionar el `Dockerfile` del subdirectorio correspondiente. Coolify construye la imagen desde el repo y la despliega, gestionando dominios + Let's Encrypt automáticamente. Estas plantillas JSON son un atajo para no tener que rellenar a mano todos los campos cuando se prefiere desplegar desde imagen ya publicada en GHCR.

## Servicios

| Plantilla                  | Servicio              | Imagen GHCR                                              | Puerto interno | Dominio sugerido        |
| -------------------------- | --------------------- | -------------------------------------------------------- | -------------- | ----------------------- |
| `directus.json`            | Backend / Headless CMS | `ghcr.io/<owner>/enterarme-directus:latest`              | 8055           | `api.enterarme.me`      |
| `ai-service.json`          | Servicio IA (Ollama)  | `ghcr.io/<owner>/enterarme-ai:latest`                    | 3030           | `ai.enterarme.me`       |
| `super-admin.json`         | Frontend super admin  | `ghcr.io/<owner>/enterarme-super-admin:latest`           | 3000           | `admin.enterarme.me`    |
| `tenant-admin.json`        | Frontend tenant admin | `ghcr.io/<owner>/enterarme-tenant-admin:latest`          | 3000           | `*.app.enterarme.me`    |
| `postgres.json`            | PostgreSQL + pgvector | `pgvector/pgvector:pg16` (o Coolify managed)            | 5432           | (interno)               |

Sustituye `<owner>` por el usuario/organización de GitHub propietaria del repo. Las imágenes se publican automáticamente con el workflow `.github/workflows/docker-publish.yml` al taggear `v*`.

## Orden de despliegue

```
1. Postgres          (Coolify managed DB o compose manual)
2. Directus          (depende de Postgres)
   └─ ejecutar scripts/init-directus.sh  (schema + seeds + superadmin token)
3. AI Service        (depende de Postgres pgvector + Ollama externo)
   └─ ejecutar scripts/load-ollama-model.sh  (crear modelo enterarme-agent en Railway)
4. Super Admin       (depende de Directus + AI)
5. Tenant Admin      (depende de Directus + AI)
```

## Cómo importar una plantilla en Coolify v4

**Opción A — Desde GitHub repo (recomendado):**

1. Coolify → **+ New Resource** → **Application** → **Public repository** (o private con deploy key).
2. Selecciona el repo `enterarme` y la rama `main`.
3. En **Build Pack**: `Dockerfile`.
4. En **Dockerfile Location**: el path relativo al Dockerfile del servicio, p.ej.:
   - `directus/Dockerfile`
   - `ai/Dockerfile`
   - `apps/super-admin/Dockerfile`
   - `apps/tenant-admin/Dockerfile`
5. **Port**: el del Dockerfile (8055 / 3030 / 3000).
6. **Domains**: el dominio público del servicio (Coolify configura Let's Encrypt automáticamente).
7. **Environment Variables**: copia las del bloque `environment` de la plantilla JSON correspondiente y rellena los `${...}` con tus secrets.
8. **Deploy**. Coolify construye y levanta el contenedor.

**Opción B — Desde imagen GHCR ya publicada:**

1. Coolify → **+ New Resource** → **Docker Compose Empty** (o **Application** vacía con `Dockerfile` falso).
2. Pega el contenido de la plantilla JSON `services:` como un `docker-compose.yml`.
3. Sustituye los `${VAR}` por valores reales o por secrets de Coolify.
4. Configura dominio + Let's Encrypt.
5. **Deploy**.

> Coolify v4 aún no tiene import directo de JSON como `service template` desde la UI pública estable, pero acepta pegar el bloque `services:`. La clave `_coolify` son metadatos humanos (no la procesa Coolify).

## Variables que DEBEN cambiarse (secrets)

Antes de desplegar nada, define estos secrets en Coolify (Project → Environment Variables, marcados como `secret`):

| Variable                    | Servicio                  | Cómo generarla                                                  |
| --------------------------- | ------------------------- | --------------------------------------------------------------- |
| `POSTGRES_PASSWORD`         | Postgres                  | `openssl rand -hex 24`                                          |
| `DIRECTUS_KEY`              | Directus                  | `openssl rand -hex 32`                                          |
| `DIRECTUS_SECRET`           | Directus (también AI JWT) | `openssl rand -hex 32`                                          |
| `DIRECTUS_ADMIN_PASSWORD`   | Directus (primer admin)   | password fuerte (min 12 chars)                                  |
| `DIRECTUS_SERVICE_TOKEN`    | Directus + AI             | `openssl rand -hex 32`                                          |
| `DIRECTUS_FRONTEND_TOKEN`   | Frontends (server-side)   | token generado desde Directus → User → Token (rol super-admin)  |
| `OLLAMA_API_KEY`            | AI                        | la que configures en el proxy Caddy delante de Ollama (Railway) |
| `NEXTAUTH_SECRET`           | Super Admin               | `openssl rand -hex 32`                                          |
| `TENANT_AUTH_SECRET`        | Tenant Admin              | `openssl rand -hex 32`                                          |

Las URLs públicas (`DIRECTUS_PUBLIC_URL`, `AI_PUBLIC_URL`, `SUPER_ADMIN_PUBLIC_URL`, `TENANT_ADMIN_PUBLIC_URL`) se derivan de los dominios que configures en Coolify.

## Dominios y Let's Encrypt

Coolify v4 emite certificados Let's Encrypt automáticamente cuando asignas un dominio a un servicio. Solo necesitas:

1. Apuntar el registro DNS A/AAAA del (sub)dominio al VPS donde corre Coolify.
2. En el servicio → **Domains** → escribir el dominio completo (p.ej. `https://api.enterarme.me`).
3. Coolify hace el challenge HTTP-01 y emite el cert.

## Wildcard domain para `*.app.enterarme.me` (Tenant Admin)

El panel de tenant-admin resuelve el tenant por **subdominio**: `miempresa.app.enterarme.me`. Para servir todos los subdominios con un solo servicio:

1. **DNS**: crea un registro **wildcard**:
   ```
   *.app  IN  A   <IP_VPS_COOLIFY>
   ```
   (o CNAME `*.app → vps.enterarme.me`).

2. **Certificado wildcard**. Let's Encrypt **no** emite wildcards vía HTTP-01; hay dos opciones:
   - **DNS-01 challenge** (recomendado): en Coolify, Project → Settings → SSL Providers → Let's Encrypt → activar DNS-01 con el provider de tu DNS (Cloudflare, DigitalOcean, Route53…). Después, al asignar `*.app.enterarme.me` al servicio tenant-admin, Coolify emite el wildcard.
   - **Certificado manual**: genera un wildcard con `certbot --manual --preferred-challenges dns` o compra uno, súbelo en el servicio → **Custom SSL Certificate**.

3. **Asignar dominio** al servicio tenant-admin: `https://*.app.enterarme.me`. Coolify enruta todo subdominio al mismo contenedor.

4. Si no quieres wildcard: cambia `TENANT_RESOLVER=path` y sirve por `app.enterarme.me/?tenant=miempresa` con un cert normal HTTP-01. Funciona pero las URLs son menos elegantes.

## Notas adicionales

- **pgvector**: el AI service usa pgvector para RAG. Si usas el Coolify managed Postgres, ejecuta `CREATE EXTENSION IF NOT EXISTS vector;` (desde el panel SQL de Coolify o deja que el AI service lo haga en el primer arranque — ya lo intenta con `IF NOT EXISTS`).
- **Ollama en Railway**: el AI service no incluye Ollama. Despliegues de Ollama en Railway ver `ai/ollama-railway.md`. Las variables `OLLAMA_HOST` y `OLLAMA_API_KEY` apuntan al servicio externo. El script `scripts/keep-ollama-warm.sh` mantiene el modelo caliente para evitar cold starts.
- **Backups**: si usas Coolify managed Postgres, activa los backups automáticos (Coolify → Database → Backups). Si usas compose manual, monta un volumen en `/backups` y programa `pg_dump` en cron.
- **Escalado**: Directus y los frontends son stateless y pueden escalar horizontalmente (Coolify: ajustar replicas en el servicio). El AI service es stateless salvo la conexión a pgvector. Postgres no escalar en modo simple — usar réplica lectura si hace falta.

## Próximos pasos tras el despliegue

1. **Esperar a que Directus arranque** (healthcheck verde).
2. **Ejecutar `scripts/init-directus.sh`** desde el VPS o un contenedor efímero conectado a la red de Coolify:
   ```bash
   DIRECTUS_URL=https://api.enterarme.me \
   DIRECTUS_ADMIN_EMAIL=admin@enterarme.me \
   DIRECTUS_ADMIN_PASSWORD=<tu-password> \
   bash scripts/init-directus.sh
   ```
   Esto aplica el schema, importa los 3 seeds y crea el token de servicio.
3. **Cargar el modelo en Ollama**: `bash scripts/load-ollama-model.sh` (ver `ai/ollama-railway.md`).
4. **Crear el primer tenant** de prueba: `bash scripts/create-tenant.sh --name "Mi Empresa" --slug mi-empresa --plan pro --email admin@miempresa.com --password <pwd> --sector <sector-uuid>`.
5. **Acceder** a `https://admin.enterarme.me` (super admin) y a `https://miempresa.app.enterarme.me` (tenant admin) y verificar el login.

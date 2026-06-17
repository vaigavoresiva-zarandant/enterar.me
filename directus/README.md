# ENTERAR.ME — Backend Directus

Backend headless CMS + API del SaaS multitenant ENTERAR.ME.
Pensado para arrancar con `docker compose up directus` y desplegar en Coolify.

## Stack

- **Directus 11** (`directus/directus:11`)
- **PostgreSQL 16** (compartido con el resto del stack)
- **Node 20** dentro del contenedor para extensiones
- **pgvector** para embeddings RAG (vector(768))
- Extensiones custom en TypeScript (endpoints + hooks)

## Estructura

```
directus/
├── Dockerfile                    # Imagen basada en directus/directus:11
├── package.json                  # Deps de extensiones
├── tsconfig.json                 # Typecheck de extensiones
├── snapshots/
│   └── schema-snapshot.yaml      # Snapshot completo del schema (20 colecciones, 41 relaciones, 80 permisos)
├── migrations/
│   └── 001_initial_schema.sql    # SQL equivalente + pgvector + índices GIN/ivfflat
├── extensions/
│   ├── endpoints/
│   │   ├── enterarme-onboarding/index.ts   # POST /onboarding/tenant
│   │   └── enterarme-agent/index.ts        # POST /agent/chat
│   └── hooks/
│       ├── validar-orden-creacion/index.ts # Valida el orden obligatorio de creación
│       └── registrar-trazabilidad/index.ts # Traza todo en eventos_tarea
├── flows/
│   ├── onboarding-tenant.json    # Flow manual alternativo al endpoint
│   ├── auto-stock-app.json       # Flow que crea la tarea 'Incluir en stock...'
│   └── marketplace-instalacion.json
├── seed/
│   ├── superadmin.json           # Rol super-admin + tenant_admin + trabajador (UUIDs fijos)
│   ├── planes.json               # Starter / Pro / Enterprise
│   └── marketplace-sectores.json # 4 sectores × 2-3 plantillas
└── README.md                     # Este archivo
```

## Cómo arrancar (desarrollo local)

Desde la raíz del repo (`enterarme/`):

```bash
# 1. Configurar variables (opcional, hay defaults)
cp .env.example .env
# Editar .env y poner al menos DIRECTUS_SERVICE_TOKEN=<token-largo-aleatorio>

# 2. Levantar todo (postgres + directus + ai + frontends)
docker compose up -d

# 3. Ver logs de directus hasta que esté listo
docker compose logs -f directus
# Cuando veas "Server started at port 8055." está listo.
```

Directus queda en **http://localhost:8055**.
El primer admin user se crea automáticamente con `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@enterarme.me` / `admin123`).

## Cómo aplicar el schema

El contenedor NO aplica el snapshot automáticamente al arrancar. Hay que hacerlo una vez:

```bash
# Opción A — vía CLI dentro del contenedor
docker compose exec directus npx directus schema apply ./snapshots/schema-snapshot.yaml -y

# Opción B — vía API (necesitas un token de admin)
#   1. Haz login:
curl -X POST http://localhost:8055/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@enterarme.me","password":"admin123"}'
#   2. Copia el access_token y aplica el snapshot:
curl -X POST http://localhost:8055/schema/snapshot \
  -H "Authorization: Bearer <TOKEN>" \
  -H 'Content-Type: application/json' \
  --data-binary @directus/snapshots/schema-snapshot.yaml
```

Si prefieres SQL plano (sin pasar por Directus):

```bash
docker compose exec postgres psql -U enterarme -d enterarme \
  -f /docker-entrypoint-initdb.d/001_initial_schema.sql
# (monta el SQL como volumen o cópialo al contenedor)
```

## Cargar los seeds

```bash
# Roles + super-admin
docker compose exec directus npx directus seed:import -s seed/superadmin.json

# Planes
docker compose exec directus npx directus seed:import -s seed/planes.json

# Sectores + plantillas del marketplace
docker compose exec directus npx directus seed:import -s seed/marketplace-sectores.json
```

> Nota: el comando `seed:import` no existe en todas las versiones de Directus.
> Como alternativa, carga cada seed vía API `POST /items/<colección>` con un
> token de admin (los seeds tienen el formato `{ "<colección>": [ ... ] }`).

## Testear el onboarding con curl

```bash
# Variables
export DIRECTUS_URL=http://localhost:8055
export SERVICE_TOKEN=$DIRECTUS_SERVICE_TOKEN   # el mismo que .env

# 1. Crear un tenant completo vía endpoint de onboarding
curl -X POST "$DIRECTUS_URL/onboarding/tenant" \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "nombre": "Mi Empresa SL",
    "slug": "mi-empresa-sl",
    "plan_id": "22222222-2000-2000-2000-000000000002",
    "admin_email": "admin@miempresa.com",
    "admin_password": "super-secret-123",
    "sector_id": "aaaa0000-0000-0000-0000-000000000001"
  }'
```

Respuesta esperada (201):

```json
{
  "tenant_id": "...",
  "admin_user_id": "...",
  "rol_admin_id": "a1111111-1111-1111-1111-111111111111",
  "ubicacion_sede_id": "...",
  "usuario_externo_id": "...",
  "usuario_interno_id": "...",
  "material_app_id": "...",
  "tarea_configurar_id": "...",
  "tarea_stock_id": "...",
  "plantillas_instaladas": [
    { "plantilla_id": "...", "nombre": "Andamio", "tipo": "material" },
    { "plantilla_id": "...", "nombre": "Revisión inicial de obra", "tipo": "tarea" },
    { "plantilla_id": "...", "nombre": "Alta de obra", "tipo": "pipeline" }
  ]
}
```

Validar que el admin del tenant puede loguearse:

```bash
curl -X POST "$DIRECTUS_URL/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@miempresa.com","password":"super-secret-123"}'
```

Con ese token, el admin solo verá los datos de su tenant (gracias al filtro
`tenant_id = $CURRENT_USER.tenant_id` en los permisos del rol `tenant_admin`).

## Testear el agente IA

```bash
curl -X POST "$DIRECTUS_URL/agent/chat" \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id": "<tenant_id_del_paso_anterior>",
    "mensaje": "¿Cuántas tareas pendientes tengo?"
  }'
```

Respuesta:

```json
{
  "conversacion_id": "...",
  "respuesta": "Tienes 2 tareas pendientes: Configurar app e Incluir en stock...",
  "skill_invocada": "listar_tareas_pendientes",
  "tool_calls": null,
  "metadata": null
}
```

> Requiere que el servicio `ai` esté levantado y accesible en `AI_SERVICE_URL`
> (por defecto `http://ai:3030`).

## Modelo de datos (resumen)

```
PLATAFORMA                    OPERACIONAL (multitenant estricto)          AGENTE IA
─────────────                 ──────────────────────────────             ──────────
planes                        ubicaciones (con tenant_id)                agente_conversaciones
tenants                       usuarios_externos                          agente_mensajes
suscripciones                 usuarios_internos                          agente_skills_log
sectores_mercado              materiales                                 agente_rag_documentos
plantillas_mercado            stocks                                       (con embedding vector(768))
instalaciones_mercado         movimientos_stock
                              tareas ── M2M ── materiales (tareas_materiales)
                              eventos_tarea      ←─── trazabilidad total
                              informes
```

### Orden obligatorio de creación (validado por hook)

```
Ubicación → Usuario externo → Usuario interno → Material → Tarea
```

El hook `validar-orden-creacion` lanza `InvalidPayloadError` si se intenta
crear una entidad sin que existan las previas en el mismo tenant.

### Trazabilidad total

El hook `registrar-trazabilidad` inserta en `eventos_tarea` un registro con
`ubicacion_id` + `timestamp` por cada acción relevante sobre `tareas` y
`movimientos_stock`. Tipos de evento:

- `inicio`, `pausa`, `reanudacion`, `fin` (cambios de estado)
- `material_usado` (movimientos de stock vinculados a tarea)
- `cambio_ubicacion` (cambio de ubicación de la tarea)
- `nota` (cualquier otra actualización, con diff en `payload`)

## Multitenant estricto

- TODA colección operacional lleva `tenant_id` FK a `tenants`.
- `directus_users` tiene un campo extra `tenant_id` (FK a `tenants`).
- Los permisos del rol `tenant_admin` (UUID `a1111111-...`) filtran con:
  ```yaml
  validation: { tenant_id: { _eq: "$CURRENT_USER.tenant_id" } }
  ```
- El rol `trabajador` (UUID `b2222222-...`) tiene acceso aún más limitado:
  solo lectura + update de tareas/stocks, y solo se edita a sí mismo.

## Despliegue en Coolify

El `Dockerfile` está listo para Coolify:

1. Crea una nueva app desde Git apuntando a este repo.
2. Build context: `enterarme/directus/` (o el subpath del monorepo si Coolify lo pide).
3. Puerto expuesto: **8055**.
4. Variables de entorno mínimas:
   - `KEY`, `SECRET` (random strings)
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
   - `DB_CLIENT=pg`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`
   - `PUBLIC_URL` (la URL pública del servicio)
   - `DIRECTUS_SERVICE_TOKEN` (token largo para endpoints custom)
   - `AI_SERVICE_URL` (URL interna del servicio IA)
5. Postgres puede ser un servicio Coolify separado o el mismo compose.

## Decisiones de diseño

- **Snapshot vs migrations**: se entregan ambos. El snapshot es la fuente de
  verdad para Directus (aplica meta + UI + permisos). El SQL es para
  entornos donde se prefiere migrar manualmente o donde se necesita pgvector
  (Directus no gestiona el tipo `vector`, así que la columna `embedding` solo
  se crea vía SQL).
- **UUIDs fijos para roles**: facilita que el snapshot y los seeds
  referencien los mismos roles sin dependencia circular.
- **Endpoint custom de onboarding**: se hace en una sola transacción knex
  para garantizar atomicidad. El `directus_user` se crea con `UsersService`
  (que hashea el password con bcrypt) y luego se enlaza dentro de la transacción.
- **Flow visual de onboarding**: se entrega como referencia (`flows/onboarding-tenant.json`).
  Hace lo mismo que el endpoint pero vía Flows UI de Directus. En producción
  se recomienda usar el endpoint (más rápido y atómico).
- **Trazabilidad best-effort**: el hook `registrar-trazabilidad` no relanza
  errores: si falla la inserción en `eventos_tarea`, la operación de negocio
  principal ya se ha hecho y no se bloquea. Los errores se loguean.

## Próximos pasos

- [ ] Añadir más skills al servicio IA (referenciadas en `agente_skills_log.skill_nombre`).
- [ ] Implementar webhook de Stripe para actualizar `suscripciones`.
- [ ] Añadir colección `facturas` + flow de generación mensual.
- [ ] Migrar la columna `embedding` a gestión nativa cuando Directus soporte pgvector.

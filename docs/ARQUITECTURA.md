# Arquitectura — ENTERAR.ME

Documento de referencia de la arquitectura técnica del SaaS multitenant **ENTERAR.ME**.
Cubre componentes, flujos, decisiones de diseño, escalado y seguridad.

> Stack: **Directus 11** (backend) · **Next.js 16** (2 frontends) · **Ollama** (IA, en Railway) · **PostgreSQL 16 + pgvector** · **Coolify** (despliegue).

---

## 1. Visión general

ENTERAR.ME es una plataforma SaaS multitenant donde cada **tenant** (organización cliente)
gestiona ubicaciones, usuarios externos/internos, materiales, stock, tareas y trazabilidad.
Un **Agente IA** (ENTERA) ayuda al usuario a operar el sistema en lenguaje natural con RAG
sobre los datos del propio tenant y skills que ejecutan acciones contra Directus.

Hay dos frontends separados:

- **Super Admin** (`admin.enterarme.me`): panel interno de ENTERAR.ME para gestionar tenants,
  planes, suscripciones, marketplace de sectores y plantillas, y un agente IA con vista global.
- **Tenant Admin** (`*.app.enterarme.me`): panel de cada cliente, con su propia auth,
  resolving de tenant por subdominio, y operativa completa sobre sus datos.

Toda la persistencia vive en un único PostgreSQL compartido, con aislamiento estricto
por la columna `tenant_id` + permisos Directus + validación en hooks.

---

## 2. Diagrama de componentes

```
                                  Internet
                                      │
                                      ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                    Coolify (VPS del cliente)                 │
   │                                                              │
   │   ┌────────────┐   ┌────────────┐   ┌────────────┐           │
   │   │  Super     │   │  Tenant    │   │            │           │
   │   │  Admin     │   │  Admin     │   │  Postgres  │           │
   │   │  Next.js   │   │  Next.js   │   │  16 +      │           │
   │   │  (3000)    │   │  (3001)    │   │  pgvector  │           │
   │   └─────┬──────┘   └─────┬──────┘   │   (5432)   │           │
   │         │                │          └─────┬──────┘           │
   │         │  API routes    │  API routes    │                  │
   │         │  (BFF)         │  (BFF)         │                  │
   │         ▼                ▼                │                  │
   │   ┌──────────────────────────┐            │                  │
   │   │   Directus 11 (8055)     │◄───────────┘                  │
   │   │   - REST/GraphQL         │                               │
   │   │   - Hooks (trazabilidad, │                               │
   │   │     orden creación)      │                               │
   │   │   - Endpoints custom:    │                               │
   │   │     /onboarding/tenant   │                               │
   │   │     /agent/chat          │                               │
   │   │   - Flows (auto-stock,   │                               │
   │   │     marketplace)         │                               │
   │   └────────────┬─────────────┘                               │
   │                │                                              │
   │                │ POST /agent/chat                             │
   │                ▼                                              │
   │   ┌──────────────────────────┐                                │
   │   │   AI Service (3030)      │                                │
   │   │   Fastify + TypeScript   │                                │
   │   │   - Orchestrator         │                                │
   │   │   - RAG (pgvector)       │                                │
   │   │   - 8 Skills             │                                │
   │   │   - Routes /chat /rag    │                                │
   │   └────────────┬─────────────┘                                │
   │                │ HTTP (con Bearer API key)                    │
   │                │                                              │
   └────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                   Railway (cloud)                            │
   │                                                              │
   │   ┌──────────────────┐         ┌──────────────────────┐      │
   │   │  Caddy (proxy)   │────────►│  Ollama              │      │
   │   │  Basic Auth      │         │  - qwen2.5:7b-       │      │
   │   │  + TLS           │         │    instruct          │      │
   │   └──────────────────┘         │  - nomic-embed-text  │      │
   │                                │  - enterarme-agent   │      │
   │                                │  (Modelfile custom)  │      │
   │                                └──────────────────────┘      │
   │                                                                │
   └──────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente          | Tecnología                              | Rol                                                          | Puerto | Dominio (prod)             |
|---------------------|-----------------------------------------|--------------------------------------------------------------|--------|----------------------------|
| Postgres            | PostgreSQL 16 + pgvector + pg_trgm      | Único almacén persistente (datos operacionales + RAG)        | 5432   | (interno)                  |
| Directus            | Directus 11 (Node 20)                   | API REST/GraphQL, auth, permisos, hooks, flows, endpoints    | 8055   | `api.enterarme.me`         |
| AI Service          | Fastify 4 + TypeScript                  | Orquestador del agente, RAG, skills                          | 3030   | `ai.enterarme.me`          |
| Super Admin         | Next.js 16 (standalone)                 | Panel interno de ENTERAR.ME                                  | 3000   | `admin.enterarme.me`       |
| Tenant Admin        | Next.js 16 (standalone)                 | Panel de cada cliente (multitenant por subdominio)           | 3000   | `*.app.enterarme.me`       |
| Ollama (Railway)    | Ollama + Modelfile custom               | Inferencia LLM (chat + embeddings)                           | 11434  | `xxx.up.railway.app`       |
| Caddy (Railway)     | Caddy 2 + Basic Auth + TLS              | Proxy de autenticación delante de Ollama                     | 80/443 | `yyy.up.railway.app`       |
| Coolify             | Coolify (self-hosted en VPS)            | Orquestador de contenedores, Let's Encrypt, dominios         | 8000   | `coolify.enterarme.me`     |

---

## 3. Flujo de una petición típica (operativa)

**Caso**: usuario del tenant-admin crea una tarea.

```
[Usuario tenant-admin] ──(1)──► [Browser]
        │
        │  POST /api/tareas  { titulo, ubicacion_id, usuario_externo_id, ... }
        ▼
[Tenant Admin (Next.js)]
        │
        │  (2) API route handler (apps/tenant-admin/src/app/api/tareas/route.ts)
        │      - Lee sesión NextAuth → user.tenant_id, user.role
        │      - Inyecta tenant_id en el body
        │      - Llama a Directus con token de servicio
        │
        │  POST https://api.enterarme.me/items/tareas
        │  Authorization: Bearer <DIRECTUS_SERVICE_TOKEN>
        │  Body: { tenant_id, titulo, ubicacion_id, usuario_externo_id, ... }
        ▼
[Directus]
        │
        │  (3) Hook `items.create` BEFORE → validar-orden-creacion
        │      - Verifica que ubicacion_id y usuario_externo_id existen
        │        y pertenecen al mismo tenant_id
        │      - Lanza InvalidPayloadError si no (rollback implícito)
        │
        │  (4) Permisos del rol tenant_admin:
        │      - validation: tenant_id _eq $CURRENT_USER.tenant_id
        │      - Si el usuario no pertenece al tenant del body → 403
        │
        │  (5) INSERT en tabla `tareas` (Postgres)
        │
        │  (6) Hook `items.create` AFTER → registrar-trazabilidad
        │      - INSERT en `eventos_tarea` con tipo='nota',
        │        payload.evento='tarea_creada', ubicacion_id, timestamp
        │      - Best-effort: no bloquea la operación principal
        │
        │  (7) Respuesta 200 OK + JSON del registro creado
        ▼
[Tenant Admin]
        │  - React Query invalida la query `tareas`
        │  - Toast de éxito (sonner)
        ▼
[Usuario] ve la tarea en el Kanban
```

Archivos clave:

- `apps/tenant-admin/src/app/api/tareas/route.ts` — BFF del tenant-admin.
- `directus/extensions/hooks/validar-orden-creacion/index.ts` — validación del orden obligatorio.
- `directus/extensions/hooks/registrar-trazabilidad/index.ts` — generación de eventos.
- `directus/snapshots/schema-snapshot.yaml` — permisos del rol `tenant_admin`.

---

## 4. Flujo del Agente IA

**Caso**: usuario pregunta *"crea una tarea de limpieza para el cliente ACME en la sede central"*.

```
[Usuario tenant-admin]
        │
        │  (1) Escribe el mensaje en el chat del panel
        ▼
[Tenant Admin]  apps/tenant-admin/src/app/(panel)/agente/page.tsx
        │
        │  (2) Hook use-agente → POST /api/agent/stream
        │      (route handler del frontend)
        │
        │  (3) API route server-side:
        │      - Lee JWT del usuario (NextAuth)
        │      - Llama a Directus: POST /agent/chat
        │        Authorization: Bearer <DIRECTUS_SERVICE_TOKEN>
        │        Body: { tenant_id, conversacion_id?, mensaje }
        ▼
[Directus]  extensions/endpoints/enterarme-agent/index.ts
        │
        │  (4) Verifica service token.
        │  (5) Verifica que el tenant existe.
        │  (6) Crea (o reutiliza) conversación en `agente_conversaciones`.
        │  (7) Persiste mensaje user en `agente_mensajes`.
        │  (8) Llama al AI Service:
        │      POST http://ai:3030/chat
        │      Authorization: Bearer <JWT del usuario>
        │      Body: { tenant_id, conversacion_id, mensaje }
        ▼
[AI Service]  ai/src/routes/chat.ts → orchestrator.runAgent()
        │
        │  (9)  ensureConversation() — verifica que conversacion_id
        │       pertenece al tenant_id del JWT (defensa en profundidad).
        │
        │  (10) RAG: retrieve(tenant_id, mensaje) → pgvector
        │       - embedText(mensaje) vía Ollama nomic-embed-text (768-d)
        │       - SELECT ... ORDER BY embedding <=> $query LIMIT 5
        │       - Devuelve contexto textual (ubicaciones, ACME, etc.)
        │       - Si falla (Ollama caído) → continúa sin contexto.
        │
        │  (11) Construye messages: [system, ...historial, user+contextoRAG]
        │
        │  (12) BUCLE de tool-calling (máx AGENT_MAX_TOOL_ITERATIONS=5):
        │       ┌─────────────────────────────────────────────────────┐
        │       │  ollamaClient.chat(messages, { tools })              │
        │       │      │                                              │
        │       │      ▼                                              │
        │       │  ¿tool_calls?                                       │
        │       │   SÍ → ejecutar cada skill:                         │
        │       │       - getSkill(name) → Skill                      │
        │       │       - parameters.safeParse(args) con zod          │
        │       │       - skill.execute(ctx, params)                  │
        │       │       - Persistir en agente_skills_log              │
        │       │       - Añadir { role: "tool", content: summary }   │
        │       │       - Continuar bucle                             │
        │       │   NO → respuesta final, salir del bucle             │
        │       └─────────────────────────────────────────────────────┘
        │
        │  (13) Persiste mensaje assistant en agente_mensajes
        │       (con skill_invocada y iterations en metadata).
        │
        │  (14) Devuelve { respuesta, skill_invocada, conversacion_id, iterations }
        ▼
[Directus]  persiste la respuesta del asistente en `agente_mensajes`
        │
        │  Devuelve al frontend { conversacion_id, respuesta, skill_invocada }
        ▼
[Tenant Admin]
        │  - Stream SSE → burbuja de assistant con cursor
        │  - Badge de skill invocada (skill-badge.tsx)
        │  - Lista de conversaciones actualizada
        ▼
[Usuario] ve:
        "Tarea 'Limpieza' creada con id 12, asignada a ubicación 3
         y usuario externo 7. Evento de trazabilidad registrado."
```

**Notas del flujo IA**:

- El JWT del usuario viaja del frontend al AI Service pasando por Directus.
  El AI Service valida el JWT con el mismo `JWT_SECRET` que Directus y comprueba
  `tenant_id` (defensa en profundidad).
- Las skills llaman a la API REST de Directus con `DIRECTUS_SERVICE_TOKEN`,
  inyectando siempre `tenant_id` del contexto (`ctx.tenant_id`).
- Si una skill falla, el log se persiste igualmente y el modelo puede reaccionar
  proponiendo otra estrategia.
- El RAG nunca bloquea: si Ollama/embeddings fallan, el agente responde sin contexto.

---

## 5. Decisiones arquitectónicas

### 5.1 ¿Por qué Directus?

- **API REST + GraphQL automáticas** sobre Postgres: ahorra meses de CRUD boilerplate.
- **Sistema de permisos por rol con validación declarativa** (`tenant_id _eq $CURRENT_USER.tenant_id`)
  — clave para multitenant sin reescribir un middleware en cada endpoint.
- **Hooks y Flows** permiten meter lógica de negocio (trazabilidad, orden de creación,
  auto-stock) sin tocar el core.
- **Endpoints custom** (extensiones) para operaciones complejas como el onboarding
  atómico del tenant (10 pasos en una transacción).
- **Schema snapshot YAML** versionable: el esquema entero del proyecto vive en
  `directus/snapshots/schema-snapshot.yaml` y se aplica con `directus schema apply`.
- **SDK JavaScript** maduro para los frontends.

### 5.2 ¿Por qué Ollama self-hosted en Railway?

- **Coste controlado**: ~5–25 USD/mes en Railway Hobby vs. facturación por token
  de OpenAI/Anthropic (que en un SaaS con uso intensivo puede dispararse).
- **Privacidad**: los datos del tenant nunca salen de la infraestructura que
  controlamos (Postgres + Ollama). Crítico para un SaaS B2B con trazabilidad.
- **Modelo personalizable**: el `Modelfile` define `enterarme-agent` con un system
  prompt específico para las reglas de negocio de ENTERAR.ME.
- **Control de versiones**: el modelo es reproducible (Misma base + mismo prompt).
- **Trade-off**: Railway no tiene GPUs → ~5–15 tokens/segundo. Aceptable para
  chat asistido. Para producción con mucha carga, migrar a VPS con GPU
  (Hetzner CCX, GCP L4) — ver `DEPLOY-OLLAMA-RAILWAY.md`.

### 5.3 ¿Por qué dos frontends separados?

- **Audiencias distintas**: el Super Admin es interno (equipo de ENTERAR.ME),
  el Tenant Admin es externo (clientes). Mezclarlos en una sola app obligaría
  a lógica de rutas compleja y aumentaría el riesgo de fugas de información.
- **Branding**: el Tenant Admin puede hacerse white-label en el plan Enterprise
  (dominio propio, logo del cliente). El Super Admin siempre es marca ENTERAR.ME.
- **Auth separada**: dos `NEXTAUTH_SECRET` distintos, dos cookies de sesión,
  dos middlewares. Si se compromete uno, el otro queda aislado.
- **Deploy independiente**: pueden escalar por separado. El Super Admin tiene
  ~10 usuarios; el Tenant Admin puede tener miles.

### 5.4 ¿Por qué BFF con API routes de Next.js?

- **Ocultar el token de servicio**: `DIRECTUS_SERVICE_TOKEN` y `DIRECTUS_FRONTEND_TOKEN`
  nunca llegan al browser. Las API routes los inyectan server-side.
- **Resolver tenant por subdominio una sola vez**: el middleware lo hace y lo
  propaga via header `x-tenant-slug` a todas las llamadas internas.
- **Composición de datos**: un endpoint del BFF puede hacer 3 llamadas a Directus
  en paralelo y devolver un DTO combinado, reduciendo round-trips del browser.
- **Streaming SSE para el chat**: las API routes de Next.js soportan streaming
  nativo, ideal para la experiencia de chat del agente.
- **Validación de sesión**: NextAuth centraliza la autenticación; el BFF es la
  única superficie pública.

### 5.5 ¿Por qué un único Postgres compartido?

- **Aislamiento lógico vs. físico**: con validación estricta en hooks y permisos
  Directus, el coste de un Postgres por tenant es prohibitivo para el plan
  Starter (19 €/mes). Multitenant lógico permite miles de tenants en una BD.
- **pgvector**: tener RAG y datos operacionales en la misma BD simplifica
  transacciones (crear tarea + indexar en RAG de forma atómica) y backups.
- **Migración futura**: si un tenant Enterprise exige BD propia, el campo
  `tenants.dominio` + `tenants.configuracion.db_connection` permite rutear
  a otra conexión sin cambiar el código.

---

## 6. Escalado

| Componente      | Estrategia de escalado                                                                                                       |
|-----------------|------------------------------------------------------------------------------------------------------------------------------|
| **Postgres**    | Vertical primero (CPU/RAM). Lecturas: réplica en Coolify. pgvector: índice ivfflat (lists=100) + particionado por tenant cuando `agente_rag_documentos` pase de 1M filas. |
| **Directus**    | Stateless → escalar horizontalmente (N contenedores tras un load balancer). Sesión en cookie firmada (no server-side). `directus_uploads` en S3/MinIO para no depender de disco local. |
| **AI Service**  | Stateless → N réplicas. Pool de Postgres con `PG_POOL_MAX=10` por instancia. RAG cacheable por (tenant_id, hash(mensaje)) si hay aciertos repetidos. |
| **Super Admin** | Stateless, standalone. 1–2 réplicas suficientes (poco tráfico).                                                              |
| **Tenant Admin**| Stateless, standalone. Escala horizontal con tráfico. Cache de TanStack Query en cliente.                                    |
| **Ollama**      | Cuello de botella principal. Estrategias: (a) `OLLAMA_KEEP_ALIVE=24h` para mantener el modelo caliente; (b) cron ping cada 5 min (`scripts/keep-ollama-warm.sh`); (c) para producción, mover a VPS con GPU; (d) shard de modelos para LLM y embeddings en instancias separadas. |
| **Postgres backups** | Snapshot diario Coolify + `pg_dump` lógico semanal a almacenamiento externo (S3).                                        |

### Límites prácticos orientativos

| Métrica                              | Valor orientativo            |
|--------------------------------------|------------------------------|
| Tenants por instancia Postgres       | ~5 000 (con tuning)          |
| Documentos RAG por tenant            | ~50 000 (ivfflat lists=100)  |
| Concurrencia Ollama (CPU-only 8GB)   | 1–2 requests en paralelo     |
| Throughput AI Service (sin Ollama)   | ~200 req/seg por réplica     |

---

## 7. Seguridad

### 7.1 Autenticación

- **Usuarios finales** (super-admin y tenant-admin): NextAuth v4 con provider
  Credentials → login contra `POST /auth/login` de Directus. El JWT devuelto
  se almacena en cookie httpOnly firmada por NextAuth.
- **Service-to-service**:
  - `DIRECTUS_SERVICE_TOKEN`:Bearer secreto compartido entre frontends, AI
    Service y Directus para llamadas server-to-server (endpoints custom como
    `/onboarding/tenant` y `/agent/chat`).
  - `DIRECTUS_FRONTEND_TOKEN`: token estático para lecturas públicas desde
    los frontends (catálogo de planes, etc.).
- **JWT compartido Directus ↔ AI Service**: el AI Service valida el JWT del
  usuario con `JWT_SECRET` (mismo valor que `SECRET` de Directus) y comprueba
  `iss` (issuer) contra `JWT_ISSUER=enterarme`.

### 7.2 Multitenant isolation

Tres capas de defensa:

1. **Esquema de datos**: toda colección operacional lleva `tenant_id` NOT NULL
   FK → `tenants(id) ON DELETE CASCADE`.
2. **Permisos Directus (declarativos)**: el rol `tenant_admin` tiene
   `validation: { tenant_id: { _eq: "$CURRENT_USER.tenant_id" } }` en create,
   y `permissions` con el mismo filtro en read/update/delete. Lo define el
   `schema-snapshot.yaml`.
3. **Validación en hooks**: `validar-orden-creacion` comprueba que toda FK
   referenciada (ubicacion_id, usuario_externo_id, etc.) pertenece al mismo
   `tenant_id` del payload. Defensa contra bypass de permisos por FK cruzada.

### 7.3 RLS en DB

A día de hoy el aislamiento se hace **a nivel de aplicación** (Directus + hooks).
Para endurecer, se puede activar Row-Level Security (RLS) en Postgres:

```sql
-- Ejemplo (no aplicado por defecto):
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tareas
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Directus debería hacer SET app.tenant_id = $1 antes de cada query.
```

Activar RLS requiere que Directus (o el AI Service) haga `SET LOCAL app.tenant_id`
al inicio de cada transacción. Queda como **trabajo futuro** documentado.

### 7.4 Tokens de servicio

- `DIRECTUS_SERVICE_TOKEN` y `DIRECTUS_FRONTEND_TOKEN` deben rotarse cada 90 días.
- En Coolify, almacenar como variables secretas (no loggear).
- En el AI Service, el token llega por cabecera `Authorization: Bearer …` y se
  compara en tiempo constante.

### 7.5 CORS

- AI Service: `CORS_ORIGINS=https://admin.enterarme.me,https://app.enterarme.me`
  (cualquier otro origen → 403).
- Directus: `CORS_ENABLED=true` + `CORS_ORIGIN` con la lista blanca.
- Frontends: sin CORS desde el browser hacia Directus — todas las llamadas
  pasan por el BFF.

### 7.6 Ollama expuesto en Railway

Ollama **no tiene auth nativo**. Se protege con un proxy Caddy delante que
exige `Authorization: Bearer $OLLAMA_API_KEY`. Sin ese token, cualquier
request es 401. Ver `DEPLOY-OLLAMA-RAILWAY.md`.

### 7.7 Backups y disaster recovery

- **Postgres**: snapshot diario automático en Coolify + `pg_dump` semanal
  a almacenamiento externo. Retención 30 días.
- **Directus uploads**: volumen Coolify con backup incremental.
- **Volúmenes Ollama** (modelos): no es necesario backup (se re-descargan).
- **RTO/RPO objetivo**: RTO 4h, RPO 24h.

---

## 8. Observabilidad

| Componente  | Mecanismo                                                                                              |
|-------------|--------------------------------------------------------------------------------------------------------|
| Directus    | Logs en stdout (Coolify los captura). Flows con logs propios. Healthcheck en `/server/health`.         |
| AI Service  | `pino` via Fastify. `/health` comprueba DB + Ollama (200 ok / 503 degraded).                           |
| Frontends   | `/api/kpis` (super-admin) como healthcheck. Sonner para errores de usuario. Sentry recomendado (opcional). |
| Agente IA   | Tabla `agente_skills_log` con `duracion_ms`, `exito`, `error` por cada ejecución de skill.             |
| Trazabilidad operativa | Tabla `eventos_tarea` con diff de cambios en tareas + movimientos de stock.                |

---

## 9. Referencias

- `README.md` (raíz) — visión de producto.
- `docs/MODELO-DATOS.md` — detalle de cada colección.
- `docs/ONBOARDING.md` — flujo completo de alta de tenant.
- `docs/DEPLOY-COOLIFY.md` — paso a paso del despliegue.
- `docs/DEPLOY-OLLAMA-RAILWAY.md` — despliegue de Ollama.
- `docs/AGENTE-RAG-SKILLS.md` — detalle del agente IA.
- `docs/BRANDING.md` — manual de marca.
- `directus/snapshots/schema-snapshot.yaml` — esquema de la BD.
- `directus/extensions/` — endpoints y hooks custom.
- `ai/src/agent/orchestrator.ts` — bucle de tool-calling.
- `apps/super-admin/src/app/` y `apps/tenant-admin/src/app/` — rutas reales de los frontends.

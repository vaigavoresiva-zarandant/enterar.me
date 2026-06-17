# ENTERAR.ME

Plataforma SaaS multitenant para el control operativo de tareas, materiales y trazabilidad total, con agente IA orquestador.

> **Stack**: Directus (backend/headless CMS) · Next.js 16 (frontends) · Ollama (IA, desplegado en Railway) · Coolify (despliegue self-hosted)

---

## ¿Qué es ENTERAR.ME?

Una plataforma donde cada **tenant** (cliente) gestiona:

- **Ubicaciones** (sedes, obras, talleres, locales…)
- **Usuarios externos** (clientes y proveedores, asignados a ubicaciones)
- **Usuarios internos** (trabajadores del tenant, con roles)
- **Materiales** (fungibles y no fungibles, asignados a usuarios externos y a la organización)
- **Tareas** (asignadas a una ubicación + usuario externo, ejecutadas por usuarios internos)

Todo queda registrado con **ubicación + timestamp**, lo que permite trazabilidad total y analítica (stock, gastos, productividad, eficiencia, ganancias…).

El **super admin** (ENTERAR.ME) controla además:
- Gestión de **tenants**
- **Planes / suscripciones**
- **Marketplace de sectores de actividad** con plantillas (addons, pipelines, materiales, tareas, usuarios…)

Cada tenant tiene un **Agente IA** (orquestador con RAG + skills) que ayuda a gestionar todo lo anterior.

---

## Reglas de negocio clave

1. **Orden obligatorio de creación** (lógica validada en backend):
   `Ubicación → Usuario externo → Usuario interno (rol) → Material → Tarea`

2. **Trazabilidad total**: toda variable interviniente en una tarea queda registrada con `ubicación + momento` en base de datos.

3. **Onboarding automático** al crear un tenant:
   - Ubicación: "Sede central"
   - Usuario externo: la propia empresa
   - Usuario interno: el admin del tenant (rol: `admin`)
   - Material no fungible: "App ENTERAR.ME"
   - Tarea: "Configurar app"
   - Auto-tarea: "Incluir en stock de Sede central el material no fungible App ENTERAR.ME"

---

## Estructura del repositorio

```
enterarme/
├── README.md                    # este archivo
├── .env.example                 # todas las variables de entorno documentadas
├── docker-compose.yml           # entorno local: directus + postgres + ai + frontends
├── .github/workflows/ci.yml     # CI: lint + typecheck + build
│
├── coolify/                     # plantillas de despliegue Coolify
│   ├── super-admin.json
│   ├── tenant-admin.json
│   ├── directus.json
│   ├── ai-service.json
│   └── README.md
│
├── directus/                    # backend
│   ├── Dockerfile
│   ├── package.json
│   ├── snapshots/schema-snapshot.yaml
│   ├── migrations/
│   ├── extensions/              # endpoints/hooks/interfaces custom
│   │   ├── endpoints/enterarme-onboarding/
│   │   ├── endpoints/enterarme-agent/
│   │   └── hooks/
│   ├── flows/                   # definición de flows Directus (JSON)
│   │   ├── onboarding-tenant.json
│   │   ├── auto-stock-app.json
│   │   └── marketplace-instalacion.json
│   ├── seed/                    # datos iniciales
│   │   ├── superadmin.json
│   │   ├── planes.json
│   │   └── marketplace-sectores.json
│   └── README.md
│
├── ai/                          # servicio IA (Ollama)
│   ├── Dockerfile
│   ├── package.json
│   ├── Modelfile                # definición del modelo Ollama
│   ├── ollama-railway.md        # guía de despliegue en Railway
│   ├── src/
│   │   ├── index.ts             # servidor (Fastify)
│   │   ├── ollama-client.ts
│   │   ├── rag/                 # embeddings + vector store + retriever
│   │   ├── skills/              # skills del agente
│   │   ├── agent/               # orchestrator + tools + prompts
│   │   └── routes/              # /chat, /health, /skills
│   └── README.md
│
├── apps/
│   ├── super-admin/             # Next.js — panel super admin (ENTERAR.ME)
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/...
│   └── tenant-admin/            # Next.js — panel admin de clientes
│       ├── Dockerfile
│       ├── package.json
│       └── src/...
│
├── docs/
│   ├── ARQUITECTURA.md
│   ├── MODELO-DATOS.md
│   ├── ONBOARDING.md
│   ├── DEPLOY-COOLIFY.md
│   ├── DEPLOY-OLLAMA-RAILWAY.md
│   ├── AGENTE-RAG-SKILLS.md
│   └── branding/                # logos SVG y PDF
│
└── scripts/
    ├── init-directus.sh
    ├── seed-marketplace.sh
    └── create-superadmin.sh
```

---

## Arranque rápido (local)

Requisitos: Docker + Docker Compose.

```bash
# 1. Clonar el repo
git clone https://github.com/<tu-usuario>/enterarme.git
cd enterarme

# 2. Copiar .env y ajustar
cp .env.example .env

# 3. Levantar todo
docker compose up -d

# 4. Inicializar Directus (schema + seed)
bash scripts/init-directus.sh
```

Servicios locales:
- Directus: http://localhost:8055  (admin@enterarme.me / ver `.env`)
- Super admin: http://localhost:3000
- Tenant admin: http://localhost:3001
- AI service: http://localhost:3030
- Postgres: localhost:5432

> ⚠️ Para el agente IA necesitas Ollama. Ver `docs/DEPLOY-OLLAMA-RAILWAY.md`.

---

## Despliegue en Coolify

Ver **`docs/DEPLOY-COOLIFY.md`** para el paso a paso. Resumen:

1. Crear 4 "Applications" en Coolify desde este repo (una por servicio):
   - `directus` (Dockerfile en `directus/`)
   - `ai` (Dockerfile en `ai/`)
   - `super-admin` (Dockerfile en `apps/super-admin/`)
   - `tenant-admin` (Dockerfile en `apps/tenant-admin/`)
2. Crear 1 "PostgreSQL" como servicio gestionado por Coolify.
3. Configurar variables de entorno (ver `.env.example`).
4. Desplegar en orden: Postgres → Directus → AI → frontends.
5. Apuntar los dominios: `admin.enterarme.me` (super admin), `app.enterarme.me` (tenant admin), `api.enterarme.me` (Directus), `ai.enterarme.me` (AI).

Plantillas JSON predefinidas en `coolify/`.

---

## Agente IA (Ollama)

El agente usa **Ollama** desplegado en Railway con un modelo personalizado (`enterarme-agent`, ver `ai/Modelfile`). Incluye:

- **RAG** sobre la base de conocimiento del tenant (ubicaciones, materiales, tareas, informes).
- **Skills** (herramientas): crear ubicación, crear usuario, crear material, crear tarea, registrar stock, generar informe, consultar trazabilidad.
- **Orquestador** que decide qué skill invocar según la intención del usuario.

Ver `docs/AGENTE-RAG-SKILLS.md` y `docs/DEPLOY-OLLAMA-RAILWAY.md`.

---

## Licencia

Privada. Todos los derechos reservados © ENTERAR.ME.

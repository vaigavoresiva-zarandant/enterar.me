# enterarme-ai

Microservicio **Node.js + TypeScript + Fastify** que actúa como capa IA de
ENTERAR.ME. Habla con **Ollama** (Railway) y expone una API REST a los
frontends. Persiste conversaciones, vectores RAG y logs de skills en Postgres
(compartido con Directus).

---

## Stack

- Node 20 + TypeScript 5 (modo `nodenext`)
- Fastify 4 + `@fastify/cors` + `@fastify/jwt`
- Cliente oficial `ollama` (npm) con reintentos y timeout
- `pg` + `pgvector` (Postgres compartido con Directus)
- `zod` para validación de env vars y parámetros de skills

---

## Arranque local

### Requisitos

- Node 20+ (o Bun)
- Postgres 16 con la extensión `pgvector`
- Ollama en local (11434) o en Railway

### 1. Instalar dependencias

```bash
cd ai
npm install
```

### 2. Variables de entorno (`.env`)

```bash
PORT=3030
DATABASE_URL=postgresql://enterarme:enterarme@localhost:5432/enterarme
OLLAMA_HOST=http://localhost:11434
OLLAMA_API_KEY=
OLLAMA_MODEL=enterarme-agent
OLLAMA_EMBED_MODEL=nomic-embed-text
DIRECTUS_URL=http://localhost:8055
DIRECTUS_SERVICE_TOKEN=<token-de-servicio-de-directus>
JWT_SECRET=<mismo-SECRET-que-directus>
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 3. Preparar Postgres

La extensión `pgvector` y las tablas `agente_*` las crea la migración de
Directus. Si trabajas sin Directus, ejecuta este SQL a mano:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS agente_rag_documentos (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  origen text NOT NULL,
  origen_id text NOT NULL,
  contenido_texto text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, origen, origen_id)
);
CREATE INDEX IF NOT EXISTS idx_rag_embedding
  ON agente_rag_documentos USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_rag_lookup
  ON agente_rag_documentos (tenant_id, origen, origen_id);

CREATE TABLE IF NOT EXISTS agente_conversaciones (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  usuario_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agente_mensajes (
  id uuid PRIMARY KEY,
  conversacion_id uuid NOT NULL REFERENCES agente_conversaciones(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mensajes_conv ON agente_mensajes (conversacion_id, created_at);

CREATE TABLE IF NOT EXISTS agente_skills_log (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  conversacion_id uuid,
  skill text NOT NULL,
  params jsonb,
  result jsonb,
  error text,
  duration_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skills_conv ON agente_skills_log (conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skills_tenant ON agente_skills_log (tenant_id, created_at);
```

### 4. Crear el modelo en Ollama

```bash
ollama pull qwen2.5:7b-instruct
ollama pull nomic-embed-text
ollama create enterarme-agent -f Modelfile
```

### 5. Arrancar en desarrollo

```bash
npm run dev      # bun --hot src/index.ts
# o
npm run build && npm start
```

El servidor escucha en `http://localhost:3030`.

---

## Endpoints

Todos los endpoints (salvo `/health`) requieren cabecera
`Authorization: Bearer <JWT>` emitido por Directus con el mismo `JWT_SECRET`.
El payload debe incluir `tenant_id`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/health` | Estado del servicio (db + ollama) |
| POST   | `/chat` | Enviar mensaje al agente y recibir respuesta |
| GET    | `/skills` | Listar skills disponibles con su JSON Schema |
| GET    | `/conversations/:id` | Historial de mensajes y log de skills |
| POST   | `/rag/index` | Indexar o borrar un documento en RAG (webhook Directus) |

### `POST /chat`

**Body**
```json
{
  "conversacion_id": "opcional-uuid",
  "mensaje": "Crea una ubicación llamada Obra Madrid",
  "historial": [
    { "role": "user", "content": "Hola" },
    { "role": "assistant", "content": "Hola, ¿qué necesitas?" }
  ]
}
```

**Respuesta**
```json
{
  "respuesta": "Ubicación \"Obra Madrid\" (tipo sede) creada con id 12.",
  "skill_invocada": ["crear_ubicacion"],
  "conversacion_id": "9c1f...-...-...",
  "iterations": 2
}
```

### `POST /rag/index`

Lo llama Directus vía webhook tras crear/editar/borrar un registro que debe
estar en el RAG del tenant.

**Indexar**
```json
{
  "accion": "index",
  "origen": "ubicacion",
  "origen_id": "12",
  "contenido_texto": "Obra Madrid (tipo sede). Dirección: C/ Mayor 1.",
  "metadata": { "tipo": "sede", "direccion": "C/ Mayor 1" }
}
```

**Borrar**
```json
{
  "accion": "delete",
  "origen": "ubicacion",
  "origen_id": "12"
}
```

---

## Test con curl

```bash
# 1. Genera un JWT con el mismo secret de Directus
TOKEN=$(node -e "console.log(require('jsonwebtoken').sign(
  { id: 'usr-1', tenant_id: '00000000-0000-0000-0000-000000000001', role: 'admin' },
  process.env.JWT_SECRET || 'enterarme-dev-secret',
  { issuer: 'enterarme', expiresIn: '1h' }))")

# 2. Health
curl http://localhost:3030/health

# 3. Skills
curl http://localhost:3030/skills -H "Authorization: Bearer $TOKEN"

# 4. Chat
curl -X POST http://localhost:3030/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mensaje":"Crea una ubicación llamada Sede Valencia de tipo sede"}'

# 5. Indexar RAG
curl -X POST http://localhost:3030/rag/index \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"accion":"index","origen":"ubicacion","origen_id":"1","contenido_texto":"Sede Valencia"}'
```

---

## Skills disponibles

| Skill | Descripción |
|-------|-------------|
| `crear_ubicacion` | Crea una ubicación (sede, obra, taller, local, almacén, otro) |
| `crear_usuario_externo` | Crea un usuario externo (cliente/proveedor/empresa) en una ubicación |
| `crear_usuario_interno` | Crea un usuario interno con rol, vinculado a un directus_user_id |
| `crear_material` | Crea un material (fungible/no fungible) asignado a un usuario externo |
| `crear_tarea` | Crea una tarea (ubicación + usuario externo + opcional usuario interno y materiales). Registra evento de trazabilidad. |
| `registrar_stock` | Registra un movimiento de stock (entrada, salida, ajuste, transferencia) |
| `consultar_trazabilidad` | Consulta eventos de tareas + movimientos de stock con filtros |
| `generar_informe` | Genera un informe (stock, gastos, productividad, eficiencia, ganancias) y lo persiste |

---

## Cómo añadir una nueva skill

1. Crea `src/skills/mi-skill.ts`:

   ```ts
   import { z } from "zod";
   import { directus } from "../directus.js";
   import { toSkillResult } from "./_helpers.js";
   import type { Skill, SkillResult } from "./types.js";

   const parameters = z.object({
     foo: z.string().min(1),
     bar: z.number().optional(),
   });

   async function execute(ctx, params): Promise<SkillResult> {
     try {
       const res = await directus.post("/items/...", { tenant_id: ctx.tenant_id, ...params });
       return { ok: true, data: res, message: "OK", summary: `Creado con id ${res.id}` };
     } catch (err) {
       return toSkillResult(err, "mi acción");
     }
   }

   export const miSkill: Skill<typeof parameters> = {
     name: "mi_skill",
     description: "Lo que hace mi skill, para que el LLM sepa cuándo usarla",
     parameters,
     execute,
   };
   ```

2. Regístrala en `src/skills/index.ts`:

   ```ts
   import { miSkill } from "./mi-skill.js";
   export const registry: Skill[] = [/* ... */, miSkill];
   ```

3. No necesitas tocar nada más: `tools.ts` convierte el schema Zod a JSON
   Schema automáticamente y el orchestrator ya la ejecutará cuando el LLM la
   invoque.

---

## Arquitectura interna

```
Frontends (Next.js) ─┐
                     ├─> /chat  ─> orchestrator.runAgent()
Directus ────────────┤                       │
  - webhooks RAG ────┤                       ├─> retriever (RAG) ─> pgvector
  - emite JWT ────────┘                       ├─> ollama.chat (tools)
                                             ├─> skills[*].execute() ─> Directus REST
                                             └─> persist mensajes + skill_log (Postgres)
```

Multitenant: **todas** las consultas a DB y todas las llamadas a Directus
filtran por `tenant_id` (viene del JWT). Las skills lo inyectan siempre en el
payload enviado a Directus.

---

## Desarrollo

```bash
npm run typecheck    # tsc --noEmit
npm run build        # tsc -> dist/
npm run start        # node dist/index.js
```

Logs: Fastify pino por defecto. Nivel `debug` en dev, `info` en prod.

---

## Ver también

- `ollama-railway.md` — desplegar Ollama en Railway
- `Modelfile` — definición del modelo `enterarme-agent`
- `../docs/AGENTE-RAG-SKILLS.md` — documento de diseño del agente (en el repo raíz)

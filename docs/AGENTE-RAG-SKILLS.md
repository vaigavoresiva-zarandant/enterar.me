# Agente IA — RAG y Skills — ENTERAR.ME

Documento de referencia del **Agente IA (ENTERA)** de ENTERAR.ME: identidad,
arquitectura interna, las 8 skills implementadas, el sistema RAG con
pgvector, el Modelfile, observabilidad y límites.

> Implementación principal: `ai/src/agent/` (orchestrator, prompts, tools),
> `ai/src/skills/` (8 skills), `ai/src/rag/` (embeddings, vector-store,
> retriever), `ai/Modelfile` (modelo Ollama).

---

## 1. Visión general

### 1.1 Identidad

- **Nombre**: ENTERA.
- **Rol**: Agente IA especializado de ENTERAR.ME, plataforma SaaS multitenant
  de control operativo de tareas, materiales y trazabilidad.
- **Idioma**: Español (es-ES), conciso y operativo. Sin muletillas.
- **Personalidad**: experto en operaciones, proactivo pero conservador
  (pregunta antes de ejecutar si faltan datos).

### 1.2 Propósito

Ayudar al usuario del tenant-admin a gestionar el sistema en lenguaje
natural:

- Crear ubicaciones, usuarios externos/internos, materiales, tareas, movimientos de stock.
- Consultar trazabilidad combinada (eventos + movimientos).
- Generar informes agregados (stock, gastos, productividad, eficiencia, ganancias).
- Responder preguntas sobre el estado del tenant usando RAG.

### 1.3 Capacidades

- **Tool-calling nativo**: el modelo decide qué skill invocar en función del
  mensaje del usuario.
- **RAG sobre la base de conocimiento del tenant**: ubicaciones, usuarios,
  materiales, tareas, informes y manuales se indexan con embeddings (768-d).
- **Bucle de iteración**: puede invocar varias skills en cadena hasta
  completar la petición (máx 5 iteraciones).
- **Multitenant estricto**: el `tenant_id` viene siempre del JWT, nunca del
  cuerpo del mensaje. Las skills lo inyectan en cada llamada a Directus.

---

## 2. Arquitectura interna

```
                    [POST /chat (AI Service)]
                              │
                              ▼
                    ┌─────────────────────┐
                    │   orchestrator      │
                    │   runAgent()        │
                    └──────────┬──────────┘
                               │
       ┌───────────────────────┼────────────────────────┐
       │                       │                        │
       ▼                       ▼                        ▼
┌──────────────┐      ┌──────────────────┐    ┌──────────────────┐
│ RAG          │      │   Prompts        │    │   Tools          │
│ retriever    │      │   SYSTEM_PROMPT  │    │   (buildTools)   │
│ (pgvector)   │      │   + ragContext   │    │   (JSON Schema)  │
└──────┬───────┘      └────────┬─────────┘    └────────┬─────────┘
       │                       │                       │
       │ embedText             │                       │ Zod → JSON Schema
       │ (nomic-embed-text)    │                       │
       ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────────────────────────────┐
│  agente_rag_ │      │       ollamaClient.chat()            │
│  documentos  │      │       (qwen2.5:7b-instruct →         │
│  (vector 768)│      │        enterarme-agent)              │
└──────────────┘      └──────────────────┬───────────────────┘
                                         │
                                         ▼
                                ┌────────────────┐
                                │  ¿tool_calls?  │
                                └────┬───────┬───┘
                                     │ SÍ   │ NO → respuesta final
                                     ▼      ▼
                       ┌──────────────────┐  ┌──────────────────┐
                       │  skill.execute() │  │  persistMessage  │
                       │  + persistSkillLog│ │  (assistant)     │
                       └────────┬─────────┘  └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  tool result →   │
                       │  next iteration  │
                       └──────────────────┘
```

### 2.1 Componentes

| Componente          | Archivo                                  | Rol                                                                       |
|---------------------|------------------------------------------|---------------------------------------------------------------------------|
| Orchestrator        | `ai/src/agent/orchestrator.ts`           | Bucle principal de tool-calling.                                          |
| Prompts             | `ai/src/agent/prompts.ts`                | System prompt dinámico (con lista de skills) + formateo de contexto RAG. |
| Tools               | `ai/src/agent/tools.ts`                  | Convierte el registry de skills a JSON Schema para Ollama function-calling. |
| Ollama client       | `ai/src/ollama-client.ts`                | Wrapper con reintentos, auth bearer, cold start handling.                 |
| RAG retriever       | `ai/src/rag/retriever.ts`                | Recupera k chunks por similitud coseno.                                   |
| RAG vector store    | `ai/src/rag/vector-store.ts`             | Operaciones SQL nativas sobre pgvector.                                   |
| RAG embeddings      | `ai/src/rag/embeddings.ts`               | embedText(text) → vector 768-d vía nomic-embed-text.                      |
| Skills registry     | `ai/src/skills/index.ts`                 | Array con las 8 skills + Map para acceso O(1).                            |
| Skills types        | `ai/src/skills/types.ts`                 | Interfaz `Skill`, `SkillContext`, `SkillResult`.                          |
| Directus client     | `ai/src/directus.ts`                     | Cliente HTTP usado por las skills.                                        |

---

## 3. Skills implementadas (8)

Cada skill:

- Es un objeto `Skill` con `name`, `description`, `parameters` (Zod), `execute()`.
- Valida sus params con `parameters.safeParse()` antes de ejecutar.
- Recibe un `SkillContext` con `tenant_id`, `conversacion_id?`, `usuario_id?`.
- Devuelve `SkillResult` con `ok`, `data?`, `message`, `summary?`.
- El `summary` se envía de vuelta al LLM como contenido del mensaje `tool`.

### 3.1 `crear_ubicacion`

**Descripción**: Crea una ubicación (sede, obra, taller, local, almacén u
otro) en el tenant. Primer paso del orden obligatorio de creación.

**Archivo**: `ai/src/skills/crear-ubicacion.ts`

**Parámetros**:

```typescript
{
  nombre: string (1–200),
  tipo: "sede" | "obra" | "taller" | "local" | "almacen" | "otro",
  direccion?: string (max 500)
}
```

**Ejemplo de invocación**:

```json
{
  "name": "crear_ubicacion",
  "arguments": {
    "nombre": "Cliente ABC",
    "tipo": "local",
    "direccion": "Calle Sol 5, Madrid"
  }
}
```

### 3.2 `crear_usuario_externo`

**Descripción**: Crea un usuario externo (cliente, proveedor o empresa)
asignado a una ubicación. Requiere que la ubicación exista (orden obligatorio).

**Archivo**: `ai/src/skills/crear-usuario-externo.ts`

**Parámetros**:

```typescript
{
  nombre: string (1–200),
  tipo: "cliente" | "proveedor" | "empresa" | "otro",
  email?: string (email válido),
  ubicacion_id: string | number
}
```

**Ejemplo**:

```json
{
  "name": "crear_usuario_externo",
  "arguments": {
    "nombre": "Acme Limpiezas S.L.",
    "tipo": "cliente",
    "email": "contacto@acme.es",
    "ubicacion_id": "abc-123-..."
  }
}
```

### 3.3 `crear_usuario_interno`

**Descripción**: Crea un usuario interno (trabajador del tenant) con un
rol. Requiere el ID de usuario de Directus (auth) y opcionalmente una
ubicación principal.

**Archivo**: `ai/src/skills/crear-usuario-interno.ts`

**Parámetros**:

```typescript
{
  directus_user_id: string (obligatorio),
  rol: "admin" | "gestor" | "operario" | "lector",
  ubicacion_principal_id?: string | number
}
```

> El `directus_user_id` debe existir previamente en `directus_users` con
> el mismo `tenant_id`. Normalmente el admin del tenant lo crea desde el
> panel de configuración antes de pedir al agente que lo asocie como
> usuario interno.

### 3.4 `crear_material`

**Descripción**: Crea un material (fungible o no fungible) asignado a un
usuario externo y al tenant. Requiere que el usuario externo exista.

**Archivo**: `ai/src/skills/crear-material.ts`

**Parámetros**:

```typescript
{
  nombre: string (1–200),
  tipo: "fungible" | "no_fungible",
  usuario_externo_id: string | number,
  unidad?: "unidad" | "kg" | "litro" | "metro" | "caja" | "paquete" | "hora" | "otro",
  costo_unitario?: number (>= 0)
}
```

**Ejemplo**:

```json
{
  "name": "crear_material",
  "arguments": {
    "nombre": "Detergente industrial 10L",
    "tipo": "fungible",
    "usuario_externo_id": "abc-...",
    "unidad": "unidad",
    "costo_unitario": 18.90
  }
}
```

### 3.5 `crear_tarea`

**Descripción**: Crea una tarea asignada a una ubicación y un usuario
externo (obligatorios), y opcionalmente a un usuario interno y materiales.
Registra evento de trazabilidad. Último paso del orden obligatorio.

**Archivo**: `ai/src/skills/crear-tarea.ts`

**Parámetros**:

```typescript
{
  titulo: string (1–200),
  descripcion?: string (max 2000),
  ubicacion_id: string | number,
  usuario_externo_id: string | number,
  usuario_interno_id?: string | number,
  material_ids?: (string | number)[],
  prioridad?: "baja" | "media" | "alta" | "urgente"
}
```

**Comportamiento**:

1. INSERT en `tareas` (estado `pendiente` por defecto).
2. INSERT en `eventos_tarea` (tipo `creacion`, best-effort).
3. Si `material_ids[]` → INSERT en `tareas_materiales` (best-effort).

**Ejemplo**:

```json
{
  "name": "crear_tarea",
  "arguments": {
    "titulo": "Limpieza semanal",
    "descripcion": "Rutina de limpieza de lunes",
    "ubicacion_id": "ubic-123",
    "usuario_externo_id": "userext-456",
    "usuario_interno_id": "userint-789",
    "prioridad": "media"
  }
}
```

### 3.6 `registrar_stock`

**Descripción**: Registra un movimiento de stock (entrada, salida, ajuste
o transferencia) para un material en una ubicación. Crea el movimiento y
deja el saldo actualizado.

**Archivo**: `ai/src/skills/registrar-stock.ts`

**Parámetros**:

```typescript
{
  ubicacion_id: string | number,
  material_id: string | number,
  cantidad: number (≠ 0),
  tipo_movimiento: "entrada" | "salida" | "ajuste" | "transferencia",
  ubicacion_destino_id?: string | number,  // obligatorio si tipo=transferencia
  referencia?: string (max 200)
}
```

**Comportamiento**:

1. Valida que las transferencias lleven `ubicacion_destino_id`.
2. INSERT en `movimientos_stock`.
3. Consulta el saldo resultante en `stocks` para el resumen.

### 3.7 `consultar_trazabilidad`

**Descripción**: Consulta trazabilidad combinada (eventos de tareas +
movimientos de stock) filtrando por ubicación, usuario externo, material,
tarea y/o rango de fechas.

**Archivo**: `ai/src/skills/consultar-trazabilidad.ts`

**Parámetros**:

```typescript
{
  ubicacion_id?: string | number,
  usuario_externo_id?: string | number,
  material_id?: string | number,
  tarea_id?: string | number,
  fecha_desde?: string (ISO 8601 datetime),
  fecha_hasta?: string (ISO 8601 datetime),
  limite?: number (1–200, default 50)
}
```

**Comportamiento**:

1. Llama en paralelo a `/items/eventos_tarea` y `/items/movimientos_stock`
   de Directus con los filtros.
2. Combina ambos resultados en un único timeline ordenado por `fecha DESC`.
3. Devuelve `{ tipo, fecha, descripcion, ubicacion_id, metadata }[]`.

### 3.8 `generar_informe`

**Descripción**: Genera un informe agregado del tenant (stock, gastos,
productividad, eficiencia o ganancias) y lo persiste en la tabla `informes`.
Devuelve filas agregadas + métrica.

**Archivo**: `ai/src/skills/generar-informe.ts`

**Parámetros**:

```typescript
{
  tipo: "stock" | "gastos" | "productividad" | "eficiencia" | "ganancias",
  parametros: {
    fecha_desde?: string,
    fecha_hasta?: string,
    ubicacion_id?: string | number,
    usuario_externo_id?: string | number,
    agrupar_por?: "ubicacion" | "material" | "usuario_externo" | "dia" | "semana" | "mes"
  } (default {})
}
```

**Tipos de informe y su agregación**:

| Tipo             | Origen datos          | Agrupación por defecto | Métrica devuelta                    |
|------------------|-----------------------|------------------------|-------------------------------------|
| `stock`          | `stocks`              | ubicación×material     | cantidad en stock                   |
| `gastos`         | `movimientos_stock`   | material               | gasto total (€)                     |
| `productividad`  | `tareas`              | usuario interno        | tareas completadas                  |
| `eficiencia`     | `tareas`              | ubicación              | ratio (completadas/total)           |
| `ganancias`      | `tareas` + `movs`     | ubicación              | ganancia estimada (€)               |

---

## 4. Resolución de intención → skill (ejemplo real)

**Mensaje del usuario**: *"crea una tarea de limpieza para el cliente ACME en la sede central"*.

### 4.1 Paso a paso

1. **RAG retrieve**: el retriever embeddea el mensaje y busca en
   `agente_rag_documentos` del tenant. Supongamos que encuentra:
   - Documento origen=ubicacion, contenido="Sede central, tipo sede, dirección …" (score 0.78).
   - Documento origen=usuario_externo, contenido="ACME Limpiezas, tipo cliente, ubicación Sede central" (score 0.82).
   - Documento origen=material, contenido="Detergente industrial 10L, fungible" (score 0.45, menos relevante).

2. **System prompt + contexto RAG** se inyectan en el mensaje user:

   ```
   Contexto relevante del tenant:
   ### Contexto 1 (ubicacion:abc-123, score=0.780)
   Sede central, tipo sede, dirección Calle Mayor 1.

   ### Contexto 2 (usuario_externo:def-456, score=0.820, tipo=cliente)
   ACME Limpiezas, tipo cliente, ubicación Sede central.

   ---
   crea una tarea de limpieza para el cliente ACME en la sede central
   ```

3. **Primera llamada a Ollama** con tools. El modelo decide:

   ```json
   {
     "tool_calls": [{
       "function": {
         "name": "crear_tarea",
         "arguments": {
           "titulo": "Limpieza",
           "ubicacion_id": "abc-123",
           "usuario_externo_id": "def-456",
           "prioridad": "media"
         }
       }
     }]
   }
   ```

   > El modelo ha extraído los IDs del contexto RAG. Si no los tuviera,
   > pediría al usuario que los confirmara.

4. **Ejecución de la skill**:
   - `crear_tarea.parameters.safeParse(args)` → OK.
   - `crear_tarea.execute(ctx, args)`:
     - POST `/items/tareas` a Directus con `tenant_id`, `titulo`, `ubicacion_id`, `usuario_externo_id`, etc.
     - POST `/items/eventos_tarea` con tipo `creacion`.
   - Resultado: `{ ok: true, data: { id: "tar-789" }, summary: "Tarea 'Limpieza' creada con id tar-789, asignada a ubicación abc-123 y usuario externo def-456." }`.
   - `persistSkillLog` → INSERT en `agente_skills_log` con `duracion_ms`, `exito=true`.

5. **Segunda llamada a Ollama** con el resultado de la tool:

   ```json
   {
     "role": "tool",
     "content": "Tarea 'Limpieza' creada con id tar-789, asignada a ubicación abc-123 y usuario externo def-456."
   }
   ```

   El modelo responde (sin más tool_calls):

   > "Tarea 'Limpieza' creada con id tar-789, asignada a Sede central y al
   > cliente ACME. Evento de trazabilidad registrado."

6. **Persistencia y respuesta**:
   - INSERT en `agente_mensajes` con rol=`assistant`, contenido=respuesta, `skill_invocada='crear_tarea'`.
   - Devuelve al frontend: `{ respuesta, skill_invocada: ['crear_tarea'], conversacion_id, iterations: 2 }`.

### 4.2 ¿Y si el modelo decide mal?

- Si los IDs no están en el contexto RAG y el modelo los inventa, la
  validación de Directus (hook `validar-orden-creacion`) rechaza con 400.
- La skill devuelve `{ ok: false, message: "tareas: la ubicacion_id no existe o no pertenece al tenant" }`.
- El `summary` se envía al LLM, que puede pedir disculpas y preguntar el ID correcto.
- Tras 5 iteraciones sin éxito, el bucle termina y devuelve la última respuesta.

---

## 5. RAG

### 5.1 Qué se indexa

La tabla `agente_rag_documentos` con campo `origen` CHECK IN:

| `origen`     | Contenido típico                                            |
|--------------|-------------------------------------------------------------|
| `ubicacion`  | "Sede central, tipo sede, dirección Calle Mayor 1."        |
| `usuario`    | "ACME Limpiezas, tipo cliente, ubicación Sede central."    |
| `material`   | "Detergente industrial 10L, fungible, SKU DETERGENTE-10L." |
| `tarea`      | "Tarea 'Limpieza semanal' en Sede central para ACME."      |
| `informe`    | "Informe de gastos octubre 2024, total 2.345 €."           |
| `manual`     | Documentación subida manualmente por el tenant (PDFs, etc.) |

### 5.2 Cómo se indexa

**Mecanismo**: webhook de Directus → POST `/rag/index` del AI Service.

**Endpoint** (`ai/src/routes/rag.ts`):

```http
POST /rag/index
Authorization: Bearer <JWT_usuario>
Content-Type: application/json

{
  "accion": "index",          // o "delete"
  "origen": "ubicacion",
  "origen_id": "abc-123",
  "contenido_texto": "Sede central, tipo sede, dirección Calle Mayor 1.",
  "metadata": { "tipo": "sede", "nombre": "Sede central" }
}
```

**Implementación SQL** (`ai/src/rag/vector-store.ts`):

```sql
INSERT INTO agente_rag_documentos
  (tenant_id, origen, origen_id, contenido_texto, metadata, embedding)
VALUES ($1, $2, $3, $4, $5, $6::vector)
ON CONFLICT (tenant_id, origen, origen_id)
DO UPDATE SET contenido_texto = EXCLUDED.contenido_texto,
              metadata        = EXCLUDED.metadata,
              embedding       = EXCLUDED.embedding
RETURNING id, (xmax = 0) AS insert_mode;
```

> El `ON CONFLICT` permite reindexar sin duplicados: si el documento ya
> existe (mismo tenant+origen+origen_id), se actualiza.

**Trigger**: en el estado actual del repo, los webhooks de Directus a
`/rag/index` deben configurarse manualmente. Lo ideal es añadir un hook
`items.create`/`items.update`/`items.delete` en
`directus/extensions/hooks/` que llame al AI Service. **Trabajo futuro**
documentado en el worklog.

### 5.3 Cómo se recupera

`ai/src/rag/retriever.ts` y `ai/src/rag/vector-store.ts`:

```sql
SELECT id, origen, origen_id, contenido_texto, metadata,
       embedding <=> $2::vector AS distancia
FROM agente_rag_documentos
WHERE tenant_id = $1
ORDER BY distancia ASC
LIMIT $3;
```

- `<=>` es la **distancia coseno** de pgvector.
- `score = 1 - distancia` (1 = idéntico, 0 = ortogonal).
- `LIMIT $3` = `RAG_TOP_K` (default 5, configurable por variable de entorno).

### 5.4 Formateo del contexto

`ai/src/agent/prompts.ts → formatRagContext()`:

```
Contexto relevante del tenant:
### Contexto 1 (ubicacion:abc-123, score=0.780, tipo=sede, nombre=Sede central)
Sede central, tipo sede, dirección Calle Mayor 1.

### Contexto 2 (usuario_externo:def-456, score=0.820, tipo=cliente)
ACME Limpiezas, tipo cliente, ubicación Sede central.

---

<mensaje original del usuario>
```

### 5.5 Limitaciones del RAG

- **Truncado a 4000 chars** por documento al embeddir (`embeddings.ts`).
- **No hay chunking** de documentos largos (manuales PDF). Para textos >4000
  chars se recomienda pre-procesarlos en chunks de ~500 tokens.
- **No hay reranking**: se usan los top-K directos del coseno. Para mejorar
  calidad, se podría añadir un reranker cross-encoder (p.ej. `bge-reranker`).

---

## 6. Modelfile

Archivo: `ai/Modelfile`.

```dockerfile
FROM qwen2.5:7b-instruct

PARAMETER temperature 0.3
PARAMETER top_p 0.85
PARAMETER num_ctx 8192
PARAMETER stop "<|im_end|>"
PARAMETER stop "</tool_call>"
PARAMETER stop "</tool_response>"

SYSTEM """Eres el Agente IA de ENTERAR.ME, plataforma SaaS multitenant de
control operativo de tareas, materiales y trazabilidad.

IDENTIDAD:
- Tu nombre es ENTERA, agente especializado de ENTERAR.ME.
- Hablas español (es-ES), conciso y operativo. No uses muletillas.
- Eres experto en operaciones: ubicaciones, usuarios externos/internos,
  materiales, tareas, stock, trazabilidad e informes.

REGLAS DE NEGOCIO OBLIGATORIAS:
1. Orden obligatorio de creación: Ubicación -> Usuario externo -> Usuario
   interno (con rol) -> Material -> Tarea.
2. Trazabilidad total: toda acción queda registrada con ubicación + momento.
3. Cada tenant es estrictamente independiente. NUNCA mezcles datos entre tenants.
4. Si el usuario pide crear algo que depende de otro registro aún no
   existente, indícalo y crea primero lo necesario (siguiendo el orden).
5. Si falta información obligatoria para invocar una skill, pregunta antes
   de ejecutar nada.

USO DE SKILLS:
- Cuando la petición del usuario requiera una acción en el sistema, llama
  a la skill correspondiente.
- Tras ejecutar una skill, resume el resultado en una frase al usuario.
- Si una skill falla, comunica el error de forma clara y propuesta de
  solución.

ESTILO:
- Respuestas cortas (máx 3-4 frases salvo que pidan detalle).
- Usa listas con guiones cuando enumeres.
- Cita identificadores de registros creados (ej: "Ubicación creada con id 12")."""
```

### 6.1 Por qué `qwen2.5:7b-instruct`

- **Buen balance razonamiento/tamaño**: 7B parámetros cabe en 6 GB RAM y
  razona bien para tareas operativas.
- **Tool-calling nativo**: Ollama soporta `tools` en `/api/chat` para
  Qwen 2.5. No todos los modelos lo soportan igual de bien.
- **Soporte de español**: Qwen se entrena con corpus multilingüe; su
  español es natural y correcto.
- **Determinismo**: `temperature 0.3` reduce creatividad, ideal para
  operaciones (queremos respuestas consistentes, no inventivas).
- **Contexto 8192 tokens**: suficiente para system prompt + historial +
  contexto RAG sin truncar.
- **Alternativa**: `llama3.1:8b-instruct` (similar en calidad, ligeramente
  más grande). Cambiar el `FROM` del Modelfile y redeploy.

### 6.2 Stops personalizados

Los `PARAMETER stop` evitan que el modelo siga generando después de un
`<|im_end|>` (token de final de turno) o de cerrar un `</tool_call>` /
`</tool_response>` (tokens que el modelo puede generar al simular
tool-calling por texto cuando no se usa el modo tools nativo).

---

## 7. Cómo añadir una nueva skill

### 7.1 Paso a paso

1. **Crea el archivo** `ai/src/skills/mi-skill.ts`:

   ```typescript
   /**
    * ai/src/skills/mi-skill.ts
    */
   import { z } from "zod";
   import { directus } from "../directus.js";
   import { toSkillResult } from "./_helpers.js";
   import type { Skill, SkillResult } from "./types.js";

   const parameters = z.object({
     // Define tus params con zod
     nombre: z.string().min(1).max(200),
   });

   async function execute(
     ctx: { tenant_id: string },
     params: z.infer<typeof parameters>
   ): Promise<SkillResult> {
     try {
       const result = await directus.post("/items/mi_coleccion", {
         tenant_id: ctx.tenant_id,
         nombre: params.nombre,
       });
       return {
         ok: true,
         data: result,
         message: `Creado: ${params.nombre}`,
         summary: `Recurso "${params.nombre}" creado con id ${result.id}.`,
       };
     } catch (err) {
       return toSkillResult(err, "crear mi recurso");
     }
   }

   export const miSkill: Skill = {
     name: "mi_skill",
     description: "Descripción clara de qué hace y cuándo invocarla.",
     parameters,
     execute,
   };
   ```

2. **Regístrala** en `ai/src/skills/index.ts`:

   ```typescript
   import { miSkill } from "./mi-skill.js";

   export const registry: Skill[] = [
     // ... skills existentes
     miSkill,
   ];
   ```

3. **Rebuildea** el AI Service (Coolify → Deploy).

4. **Verifica** que aparece en el listado:

   ```bash
   curl https://ai.enterarme.me/skills \
     -H "Authorization: Bearer $JWT"
   ```

### 7.2 Convenciones

- **Nombre**: snake_case, verbos en infinitivo (`crear_x`, `registrar_x`,
  `consultar_x`, `generar_x`).
- **Descripción**: debe dejar claro al LLM **cuándo** invocarla. Mencionar
  prerrequisitos (orden obligatorio) ayuda al modelo a decidir.
- **Params**: usar `z.union([z.string(), z.number()])` para IDs (los
  modelos LLM a veces devuelven números como strings).
- **Trazabilidad**: si la skill modifica datos operacionales, dejar
  registro en `eventos_tarea` o `movimientos_stock` (best-effort).
- **Errores**: usar `toSkillResult(err, "acción")` para mensajes legibles.

---

## 8. Métricas y observabilidad

### 8.1 `agente_skills_log`

Cada ejecución de skill (exitosa o no) deja una fila:

| Campo              | Descripción                                            |
|--------------------|--------------------------------------------------------|
| `id`               | UUID.                                                  |
| `conversacion_id`  | Si forma parte de una conversación.                    |
| `skill_nombre`     | Ej. `crear_tarea`.                                     |
| `input`            | JSON con los params con los que se llamó.              |
| `output`           | JSON con el resultado (o null si falló).               |
| `duracion_ms`      | Latencia total (validación + ejecución + persistencia).|
| `exito`            | Boolean.                                               |
| `error`            | Mensaje si `exito=false`.                             |
| `timestamp`        | Momento.                                               |

**Queries útiles**:

```sql
-- Skills más invocadas en las últimas 24h por tenant
SELECT skill_nombre, COUNT(*) AS n, AVG(duracion_ms) AS avg_ms,
       SUM(CASE WHEN exito THEN 0 ELSE 1 END) AS errores
FROM agente_skills_log l
JOIN agente_conversaciones c ON c.id = l.conversacion_id
WHERE c.tenant_id = $1
  AND l.timestamp > NOW() - INTERVAL '24 hours'
GROUP BY skill_nombre
ORDER BY n DESC;

-- Skills con mayor tasa de error
SELECT skill_nombre,
       COUNT(*) FILTER (WHERE NOT exito) AS errores,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE NOT exito) / COUNT(*), 1) AS pct_error
FROM agente_skills_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY skill_nombre
HAVING COUNT(*) > 5
ORDER BY pct_error DESC;
```

### 8.2 `agente_mensajes`

Cada mensaje (user / assistant / tool) de cada conversación se persiste
con `tool_calls` (JSON) y `skill_invocada` (string atajo). Permite:

- Auditar conversaciones completas.
- Hacer replay de un mensaje para depurar.
- Métricas de uso: nº de mensajes por usuario, conversaciones por día, etc.

### 8.3 Healthcheck del AI Service

```http
GET /health
```

Devuelve:

```json
{
  "status": "ok",          // o "degraded"
  "service": "enterarme-ai",
  "ts": "2025-01-15T10:30:00.000Z",
  "checks": {
    "db": true,             // conexión a Postgres
    "ollama": true          // Ollama reachable + modelo cargado
  },
  "ollama_model": "enterarme-agent"
}
```

Si `status: "degraded"`, el AI Service sigue aceptando peticiones pero
las skills que dependen del componente caído fallarán (RAG no bloqueante).

### 8.4 Logs estructurados

El AI Service usa `pino` (vía Fastify). Cada request loguea:

- `reqId`, `method`, `url`, `statusCode`, `responseTime`.
- Errores con stack trace.
- En modo debug: mensajes del orchestrator (iteraciones, tool_calls).

Configura el nivel con `NODE_ENV`:
- `production` → `info`.
- `development` → `debug`.

---

## 9. Límites operativos

| Límite                              | Valor por defecto                | Variable de entorno              |
|-------------------------------------|----------------------------------|----------------------------------|
| Iteraciones de tool-calling         | 5                                | `AGENT_MAX_TOOL_ITERATIONS`      |
| Tokens de contexto del modelo       | 8192                             | `PARAMETER num_ctx` (Modelfile)  |
| RAG top-K                           | 5                                | `RAG_TOP_K`                      |
| Truncado de texto al embeddir       | 4000 chars                       | Hardcodeado en `embeddings.ts`   |
| Latencia máxima Ollama              | 120000 ms                        | `OLLAMA_TIMEOUT_MS`              |
| Reintentos Ollama                   | 3                                | `OLLAMA_MAX_RETRIES`             |
| Conexiones pool Postgres            | 10                               | `PG_POOL_MAX`                    |

### 9.1 ¿Qué pasa si se alcanza el límite de iteraciones?

Si tras 5 iteraciones el modelo sigue invocando tools (sin dar respuesta
final), el orchestrator devuelve una respuesta de fallback:

> "He ejecutado las siguientes acciones: skill1, skill2. ¿Necesitas algo más?"

Y persiste el mensaje assistant con `iterations: 5` en metadata. Útil para
detectar loops infinitos y mejorar el prompt.

### 9.2 ¿Qué pasa si RAG falla?

El RAG es **no bloqueante**. Si `retrieve()` lanza (Ollama caído, sin
`nomic-embed-text`, error de DB), el orchestrator lo captura y continúa
sin contexto. El modelo responde basándose solo en el system prompt y el
historial.

```typescript
// ai/src/agent/orchestrator.ts (resumido)
let ragContext = "";
try {
  const retrieved = await retrieve(input.tenant_id, input.mensaje);
  ragContext = formatRagContext(retrieved.contextText);
} catch (err) {
  console.warn("[orchestrator] RAG falló (continuando sin contexto):", err);
}
```

---

## 10. Seguridad

### 10.1 Multitenant

- El `tenant_id` se extrae del JWT (verificado por `@fastify/jwt` con
  `JWT_SECRET` compartido con Directus).
- **Nunca** se lee del body ni se confía en el `tenant_id` que mande el
  frontend en el JSON.
- Cada skill inyecta `ctx.tenant_id` en cada llamada a Directus.
- `/conversations/:id` verifica que la conversación pertenece al tenant
  del JWT antes de devolver el historial.

### 10.2 Skills

- Las skills llaman a Directus con `DIRECTUS_SERVICE_TOKEN` (no con el
  token del usuario). Directus aplica los permisos del rol `tenant_admin`
  o `trabajador` según el token.
- Validación de params con zod antes de ejecutar: evita inyecciones o
  tipos incorrectos.
- `toSkillResult()` no expone stack traces al LLM, solo mensajes legibles.

### 10.3 RAG

- `deleteByOrigin(tenant_id, origen, origen_id)` solo borra del tenant
  indicado (filtrado por `WHERE tenant_id = $1`).
- `deleteByTenant(tenant_id)` se usa al purgar un tenant completo.

---

## 11. Referencias

- `ai/Modelfile` — modelo Ollama `enterarme-agent`.
- `ai/src/agent/orchestrator.ts` — bucle principal.
- `ai/src/agent/prompts.ts` — system prompt dinámico.
- `ai/src/agent/tools.ts` — conversión Zod → JSON Schema.
- `ai/src/skills/index.ts` — registry de skills.
- `ai/src/skills/types.ts` — interfaz `Skill`.
- `ai/src/skills/_helpers.ts` — `toSkillResult`.
- `ai/src/rag/embeddings.ts` — embeddings con nomic-embed-text.
- `ai/src/rag/vector-store.ts` — operaciones pgvector.
- `ai/src/rag/retriever.ts` — recuperación + formateo.
- `ai/src/routes/chat.ts` — endpoint POST /chat.
- `ai/src/routes/rag.ts` — endpoint POST /rag/index.
- `ai/src/routes/skills.ts` — endpoint GET /skills.
- `ai/src/routes/conversations.ts` — endpoint GET /conversations/:id.
- `directus/extensions/endpoints/enterarme-agent/index.ts` — endpoint Directus que llama al AI Service.
- `docs/DEPLOY-OLLAMA-RAILWAY.md` — despliegue de Ollama.
- `docs/MODELO-DATOS.md` — detalle de las tablas `agente_*`.

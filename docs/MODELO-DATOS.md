# Modelo de Datos — ENTERAR.ME

Documento de referencia del esquema de base de datos de **ENTERAR.ME**.
Cubre todas las colecciones (operacionales + plataforma + agente IA), sus
relaciones, reglas multitenant, trazabilidad e índices.

> Fuente de verdad: `directus/snapshots/schema-snapshot.yaml` (Directus 11) y
> `directus/migrations/001_initial_schema.sql` (PostgreSQL 16 + pgvector).

---

## 1. Convenciones

- **PKs**: UUID (`gen_random_uuid()` en Postgres).
- **Multitenant**: toda colección operacional lleva `tenant_id UUID NOT NULL`
  FK → `tenants(id) ON DELETE CASCADE`.
- **Timestamps**: `timestamptz` (UTC). `created_at`/`updated_at` automáticos
  vía trigger `set_updated_at()`.
- **Soft-delete**: campo `activo BOOLEAN NOT NULL DEFAULT TRUE` en colecciones
  que lo necesitan (ubicaciones, materiales, usuarios, plantillas…).
- **Check constraints**: enums implementados como `VARCHAR` + `CHECK IN (…)`
  en SQL (Directus los trata como `string` con validación).
- **Roles fijos** (UUID estables, compartidos entre snapshot y seeds):
  - `super-admin`: `00000000-0000-0000-0000-000000000001`
  - `tenant_admin`: `a1111111-1111-1111-1111-111111111111`
  - `trabajador`: `b2222222-2222-2222-2222-222222222222`

---

## 2. Listado de colecciones

### 2.1 Plataforma / multitenant (6)

| Colección                | Propósito                                                                          |
|--------------------------|------------------------------------------------------------------------------------|
| `planes`                 | Planes de suscripción del SaaS (Starter, Pro, Enterprise).                         |
| `tenants`                | Organizaciones cliente. Raíz del aislamiento multitenant.                          |
| `suscripciones`          | Vincula un tenant con un plan y gestiona facturación/estado.                       |
| `sectores_mercado`       | Sectores disponibles en el marketplace (Construcción, Hostelería, …).              |
| `plantillas_mercado`     | Plantillas reutilizables (material, tarea, pipeline, addon, usuario) por sector.   |
| `instalaciones_mercado`  | Log de plantillas instaladas en cada tenant (auditoría).                           |

### 2.2 Operacional del tenant (9)

Todas con `tenant_id` FK → `tenants(id) ON DELETE CASCADE`.

| Colección             | Propósito                                                                                  |
|-----------------------|--------------------------------------------------------------------------------------------|
| `ubicaciones`         | Sedes, obras, talleres, locales, almacenes. **Primer paso del orden de creación.**         |
| `usuarios_externos`   | Clientes, proveedores o `empresa_propia` asignados a una ubicación. Segundo paso.          |
| `usuarios_internos`   | Trabajadores del tenant, ligados a `directus_users` vía `directus_user_id`. Tercer paso.   |
| `materiales`          | Recursos (fungibles / no fungibles), asignados a un usuario externo y al tenant. Cuarto.   |
| `stocks`              | Saldo de un material en una ubicación (único por par ubicación×material).                  |
| `movimientos_stock`   | Trazabilidad de stock: entradas, salidas, ajustes (con `ubicacion_id` + `timestamp`).      |
| `tareas`              | Tareas operativas (asignadas a ubicación + usuario externo + opcional interno). Quinto.    |
| `tareas_materiales`   | Junction M2M entre `tareas` y `materiales` (con cantidad).                                 |
| `eventos_tarea`       | Trazabilidad total: cualquier cambio en tareas/stock deja un evento con ubicación+momento.|
| `informes`            | Informes generados por el usuario o por el agente IA (stock, gastos, …).                   |

### 2.3 Agente IA (4)

| Colección                | Propósito                                                                  |
|--------------------------|----------------------------------------------------------------------------|
| `agente_conversaciones`  | Conversaciones del agente con usuarios del tenant.                         |
| `agente_mensajes`        | Mensajes (rol user/assistant/tool) con `tool_calls` y `skill_invocada`.   |
| `agente_skills_log`      | Log de cada ejecución de skill: input, output, duración, error.           |
| `agente_rag_documentos`  | Base de conocimiento RAG con `embedding vector(768)` (pgvector).          |

### 2.4 Sistema (extendida)

| Colección        | Propósito                                                              |
|------------------|------------------------------------------------------------------------|
| `directus_users` | Usuarios de Directus. **Extendida** con `tenant_id` para filtrar por rol. |

> Total: **21 colecciones** (6 plataforma + 9 operacional + 4 agente + 1 sistema extendida + 1 junction).

---

## 3. Diagrama ER (relaciones principales)

```
                                ┌──────────┐
                                │  planes  │
                                └────┬─────┘
                                     │ 1
                                     │
                                     ▼ N
   ┌──────────────┐         ┌───────────────┐         ┌──────────────────┐
   │ sectores_    │ N     N │   tenants     │ 1     N │  suscripciones   │
   │ mercado ◄────┼────────┤   (root)      ├────────►│                  │
   └──────┬───────┘         └───────┬───────┘         └──────────────────┘
          │ 1                       │ 1
          │                         │
          ▼ N                       ▼ N
   ┌──────────────────┐      ┌──────────────────┐
   │ plantillas_      │      │  ubicaciones     │
   │ mercado          │      └───────┬──────────┘
   └──────────────────┘              │ 1
                                     │
              ┌──────────────────────┼─────────────────────┐
              │ 1                    │ 1                   │ 1
              ▼ N                    ▼ N                   ▼ N
   ┌──────────────────┐     ┌──────────────────┐  ┌──────────────────┐
   │ usuarios_        │     │ usuarios_        │  │   tareas         │
   │ externos         │     │ internos         │  │                  │
   └──────┬───────────┘     └────────┬─────────┘  └────┬─────────────┘
          │ 1                        │ 1               │ N
          │                          │                 │
          │ N                        │ N               │ N (M2M)
          ▼                          ▼                 ▼
   ┌──────────────────┐     ┌──────────────────┐  ┌──────────────────┐
   │ materiales       │ N─► │ directus_users   │  │ tareas_materiales│
   └──────┬───────────┘     └──────────────────┘  └──────────────────┘
          │ 1
          │
          │ N (único por par)
          ▼
   ┌──────────────────┐  N    1  ┌──────────────────┐
   │ stocks           │◄────────►│ movimientos_stock│
   └──────────────────┘          └──────┬───────────┘
                                        │ N
                                        │
                                        ▼
                                 ┌──────────────────┐
                                 │  eventos_tarea   │
                                 │  (trazabilidad)  │
                                 └──────────────────┘

   ┌──────────────────┐          ┌──────────────────────────┐
   │  informes        │          │  agente_rag_documentos   │
   └──────────────────┘          │  (vector(768) por tenant)│
                                 └──────────────────────────┘

   ┌────────────────────────┐    ┌──────────────────────┐    ┌─────────────────────┐
   │ agente_conversaciones  │─► │ agente_mensajes      │ ─► │ agente_skills_log   │
   └────────────────────────┘    └──────────────────────┘    └─────────────────────┘
```

Relaciones **41** totales declaradas en `schema-snapshot.yaml` (FKs + M2M + O2M + M2A).

---

## 4. Detalle por colección principal

### 4.1 `planes`

| Campo           | Tipo            | Restricciones                          | Descripción                                   |
|-----------------|-----------------|----------------------------------------|-----------------------------------------------|
| `id`            | UUID            | PK, default `gen_random_uuid()`        | Identificador.                                |
| `nombre`        | VARCHAR(120)    | NOT NULL                               | "Starter", "Pro", "Enterprise".               |
| `precio_mensual`| NUMERIC(10,2)   | NOT NULL, default 0                    | Precio en euros.                              |
| `max_usuarios`  | INTEGER         | NOT NULL, default -1 (-1 = ilimitado)  | Límite de usuarios internos.                  |
| `max_ubicaciones`| INTEGER        | NOT NULL, default -1                   | Límite de ubicaciones.                        |
| `max_materiales`| INTEGER         | NOT NULL, default -1                   | Límite de materiales.                         |
| `caracteristicas`| JSONB          | default `'{}'`                         | Feature flags (agente_ia, rag, sso, …).       |
| `activo`        | BOOLEAN         | NOT NULL, default TRUE                 | Soft-delete.                                  |
| `sort`          | INTEGER         | nullable                               | Orden de presentación.                        |

### 4.2 `tenants`

| Campo           | Tipo            | Restricciones                                       | Descripción                                |
|-----------------|-----------------|-----------------------------------------------------|--------------------------------------------|
| `id`            | UUID            | PK                                                  | Identificador del tenant.                  |
| `nombre`        | VARCHAR(200)    | NOT NULL                                            | Nombre de la organización.                 |
| `slug`          | VARCHAR(100)    | NOT NULL, UNIQUE                                    | Para subdominios y URLs.                   |
| `plan_id`       | UUID            | FK → `planes(id) ON DELETE SET NULL`                | Plan actual.                               |
| `estado`        | VARCHAR(20)     | NOT NULL, CHECK IN (`activo`, `trial`, `suspendido`, `inactivo`) | Estado de la cuenta. |
| `dominio`       | VARCHAR(255)    | UNIQUE                                              | Dominio custom (plan Enterprise).          |
| `fecha_alta`    | TIMESTAMPTZ     | NOT NULL, default NOW()                             | Fecha de alta.                             |
| `configuracion` | JSONB           | default `'{}'`                                      | Preferencias (idioma, moneda, plantillas). |

### 4.3 `suscripciones`

| Campo              | Tipo         | Restricciones                                       | Descripción                        |
|--------------------|--------------|-----------------------------------------------------|------------------------------------|
| `id`               | UUID         | PK                                                  | Identificador.                     |
| `tenant_id`        | UUID         | NOT NULL, FK → tenants, ON DELETE CASCADE           | Tenant al que pertenece.           |
| `plan_id`          | UUID         | NOT NULL, FK → planes, ON DELETE RESTRICT           | Plan suscrito.                     |
| `estado`           | VARCHAR(20)  | CHECK IN (`activa`, `pendiente`, `suspendida`, `cancelada`) | Estado de facturación.   |
| `fecha_inicio`     | DATE         | nullable                                            | Inicio del periodo.                |
| `fecha_fin`        | DATE         | nullable                                            | Fin del periodo.                   |
| `metodo_pago`      | VARCHAR(60)  | nullable                                            |stripe / invoice / manual.          |
| `proxima_factura`  | DATE         | nullable                                            | Próxima fecha de cobro.            |

### 4.4 `ubicaciones`

| Campo            | Tipo          | Restricciones                                   | Descripción                                  |
|------------------|---------------|-------------------------------------------------|----------------------------------------------|
| `id`             | UUID          | PK                                              |                                              |
| `tenant_id`      | UUID          | NOT NULL, FK → tenants, CASCADE                 | Aislamiento multitenant.                     |
| `nombre`         | VARCHAR(160)  | NOT NULL                                        | "Sede central", "Obra calle Mayor", …        |
| `tipo`           | VARCHAR(20)   | NOT NULL, CHECK IN (`sede`, `obra`, `taller`, `local`, `otro`) | Tipo de ubicación. |
| `direccion`      | TEXT          | nullable                                        | Texto libre.                                 |
| `lat`, `lng`     | NUMERIC(9,6)  | nullable                                        | Geolocalización.                             |
| `activa`         | BOOLEAN       | NOT NULL, default TRUE                          | Soft-delete.                                 |
| `fecha_creacion` | TIMESTAMPTZ   | NOT NULL, default NOW()                         |                                              |

### 4.5 `usuarios_externos`

| Campo           | Tipo          | Restricciones                                                          | Descripción                                |
|-----------------|---------------|------------------------------------------------------------------------|--------------------------------------------|
| `id`            | UUID          | PK                                                                     |                                            |
| `tenant_id`     | UUID          | NOT NULL, FK → tenants, CASCADE                                        |                                            |
| `nombre`        | VARCHAR(200)  | NOT NULL                                                               | Nombre del cliente/proveedor.              |
| `tipo`          | VARCHAR(20)   | NOT NULL, CHECK IN (`cliente`, `proveedor`, `empresa_propia`)          | Tipo de relación.                          |
| `email`         | VARCHAR(255)  | nullable                                                               |                                            |
| `telefono`      | VARCHAR(40)   | nullable                                                               |                                            |
| `ubicacion_id`  | UUID          | FK → ubicaciones, ON DELETE SET NULL                                   | Ubicación principal.                       |
| `metadata`      | JSONB         | default `'{}'`                                                         | Datos libres (CIF, contactos, …).          |
| `activo`        | BOOLEAN       | NOT NULL, default TRUE                                                 | Soft-delete.                               |

### 4.6 `usuarios_internos`

| Campo                    | Tipo          | Restricciones                                                            | Descripción                          |
|--------------------------|---------------|--------------------------------------------------------------------------|--------------------------------------|
| `id`                     | UUID          | PK                                                                       |                                      |
| `tenant_id`              | UUID          | NOT NULL, FK → tenants, CASCADE                                          |                                      |
| `directus_user_id`       | UUID          | NOT NULL, UNIQUE, FK → directus_users, ON DELETE CASCADE                 | Auth.                                |
| `nombre`                 | VARCHAR(200)  | NOT NULL                                                                 | Nombre display.                      |
| `rol`                    | VARCHAR(20)   | NOT NULL, CHECK IN (`admin`, `gestor`, `trabajador`, `consultor`)        | Rol dentro del tenant.               |
| `ubicacion_principal_id` | UUID          | FK → ubicaciones, ON DELETE SET NULL                                     | Ubicación por defecto.               |
| `activo`                 | BOOLEAN       | NOT NULL, default TRUE                                                   | Soft-delete.                         |

### 4.7 `materiales`

| Campo                | Tipo            | Restricciones                                            | Descripción                                |
|----------------------|-----------------|----------------------------------------------------------|--------------------------------------------|
| `id`                 | UUID            | PK                                                       |                                            |
| `tenant_id`          | UUID            | NOT NULL, FK → tenants, CASCADE                          |                                            |
| `nombre`             | VARCHAR(200)    | NOT NULL                                                 |                                            |
| `tipo`               | VARCHAR(20)     | NOT NULL, CHECK IN (`fungible`, `no_fungible`)           |                                            |
| `sku`                | VARCHAR(60)     | nullable                                                 | Código interno.                            |
| `unidad`             | VARCHAR(20)     | default `ud`                                             | ud, kg, l, m, caja, hora…                  |
| `costo_unitario`     | NUMERIC(12,2)   | default 0                                                | Coste de compra.                           |
| `usuario_externo_id` | UUID            | FK → usuarios_externos, ON DELETE SET NULL               | Cliente/proveedor asociado.                |
| `organization_id`    | UUID            | FK → tenants, ON DELETE SET NULL                         | Self-ref al tenant propietario.            |
| `metadata`           | JSONB           | default `'{}'`                                           | Atributos libres (categoría, vida útil…).  |
| `activo`             | BOOLEAN         | NOT NULL, default TRUE                                   | Soft-delete.                               |

### 4.8 `stocks`

| Campo                | Tipo            | Restricciones                              | Descripción                              |
|----------------------|-----------------|--------------------------------------------|------------------------------------------|
| `id`                 | UUID            | PK                                         |                                          |
| `tenant_id`          | UUID            | NOT NULL, FK → tenants, CASCADE            |                                          |
| `ubicacion_id`       | UUID            | NOT NULL, FK → ubicaciones, CASCADE        |                                          |
| `material_id`        | UUID            | NOT NULL, FK → materiales, CASCADE         |                                          |
| `cantidad`           | NUMERIC(14,2)   | NOT NULL, default 0                        | Saldo actual.                            |
| `fecha_actualizacion`| TIMESTAMPTZ     | NOT NULL, default NOW() (trigger updated)  |                                          |
| `umbral_alerta`      | NUMERIC(14,2)   | default 0                                  | Stock mínimo para alertas.               |

Constraint UNIQUE `(ubicacion_id, material_id)` — un registro por par.

### 4.9 `movimientos_stock`

| Campo                | Tipo            | Restricciones                                            | Descripción                                |
|----------------------|-----------------|----------------------------------------------------------|--------------------------------------------|
| `id`                 | UUID            | PK                                                       |                                            |
| `tenant_id`          | UUID            | NOT NULL, FK → tenants, CASCADE                          |                                            |
| `stock_id`           | UUID            | FK → stocks, ON DELETE SET NULL                          | Stock afectado (nullable si se borra).     |
| `tipo`               | VARCHAR(20)     | NOT NULL, CHECK IN (`entrada`, `salida`, `ajuste`)       | Tipo de movimiento.                        |
| `cantidad`           | NUMERIC(14,2)   | NOT NULL, default 0                                      | Firmada (positiva en entradas/salidas).    |
| `motivo`             | VARCHAR(255)    | nullable                                                 |                                            |
| `tarea_id`           | UUID            | FK → tareas, ON DELETE SET NULL                          | Si el movimiento viene de una tarea.       |
| `ubicacion_id`       | UUID            | NOT NULL, FK → ubicaciones, ON DELETE RESTRICT           | Ubicación + momento.                       |
| `material_id`        | UUID            | NOT NULL, FK → materiales, ON DELETE RESTRICT            |                                            |
| `usuario_interno_id` | UUID            | FK → usuarios_internos, ON DELETE SET NULL               | Quién lo hizo.                             |
| `timestamp`          | TIMESTAMPTZ     | NOT NULL, default NOW()                                  | Momento del movimiento.                    |

### 4.10 `tareas`

| Campo                | Tipo            | Restricciones                                                                      | Descripción                          |
|----------------------|-----------------|------------------------------------------------------------------------------------|--------------------------------------|
| `id`                 | UUID            | PK                                                                                 |                                      |
| `tenant_id`          | UUID            | NOT NULL, FK → tenants, CASCADE                                                    |                                      |
| `ubicacion_id`       | UUID            | NOT NULL, FK → ubicaciones, ON DELETE RESTRICT                                     | Dónde se ejecuta.                    |
| `usuario_externo_id` | UUID            | NOT NULL, FK → usuarios_externos, ON DELETE RESTRICT                               | Para quién.                          |
| `usuario_interno_id` | UUID            | FK → usuarios_internos, ON DELETE SET NULL                                         | Quién la ejecuta.                    |
| `titulo`             | VARCHAR(255)    | NOT NULL                                                                           |                                      |
| `descripcion`        | TEXT            | nullable                                                                           |                                      |
| `estado`             | VARCHAR(20)     | NOT NULL, CHECK IN (`pendiente`, `en_progreso`, `completada`, `cancelada`)         |                                      |
| `prioridad`          | VARCHAR(20)     | NOT NULL, CHECK IN (`baja`, `media`, `alta`, `urgente`)                            |                                      |
| `fecha_asignacion`   | TIMESTAMPTZ     | default NOW()                                                                      |                                      |
| `fecha_inicio`       | TIMESTAMPTZ     | nullable                                                                           |                                      |
| `fecha_fin`          | TIMESTAMPTZ     | nullable                                                                           |                                      |
| `duracion_minutos`   | INTEGER         | default 0                                                                          | Duración real.                       |
| `costo_total`        | NUMERIC(14,2)   | default 0                                                                          | Coste agregado de materiales + horas.|
| `metadata`           | JSONB           | default `'{}'`                                                                     | Plantillas, checklist, …             |

### 4.11 `tareas_materiales` (junction M2M)

| Campo         | Tipo          | Restricciones                                       | Descripción                |
|---------------|---------------|-----------------------------------------------------|----------------------------|
| `id`          | UUID          | PK                                                  |                            |
| `tarea_id`    | UUID          | NOT NULL, FK → tareas, CASCADE                      |                            |
| `material_id` | UUID          | NOT NULL, FK → materiales, CASCADE                  |                            |
| `cantidad`    | NUMERIC(14,2) | default 1                                           | Cantidad usada en la tarea.|

UNIQUE `(tarea_id, material_id)`.

### 4.12 `eventos_tarea` (trazabilidad)

| Campo                | Tipo          | Restricciones                                                                 | Descripción                                  |
|----------------------|---------------|-------------------------------------------------------------------------------|----------------------------------------------|
| `id`                 | UUID          | PK                                                                            |                                              |
| `tarea_id`           | UUID          | NOT NULL, FK → tareas, CASCADE                                                | Tarea asociada.                              |
| `tipo`               | VARCHAR(30)   | NOT NULL, CHECK IN (`inicio`, `pausa`, `reanudacion`, `fin`, `material_usado`, `nota`, `cambio_ubicacion`) | Tipo de evento. |
| `payload`            | JSONB         | default `'{}'`                                                                | Diff del cambio o datos del evento.          |
| `timestamp`          | TIMESTAMPTZ   | NOT NULL, default NOW()                                                       | **Momento** — clave de trazabilidad.         |
| `usuario_interno_id` | UUID          | FK → usuarios_internos, ON DELETE SET NULL                                    | Quién lo generó.                             |
| `ubicacion_id`       | UUID          | FK → ubicaciones, ON DELETE SET NULL                                          | **Ubicación** — clave de trazabilidad.       |

### 4.13 `informes`

| Campo                       | Tipo          | Restricciones                                                               | Descripción                          |
|-----------------------------|---------------|-----------------------------------------------------------------------------|--------------------------------------|
| `id`                        | UUID          | PK                                                                          |                                      |
| `tenant_id`                 | UUID          | NOT NULL, FK → tenants, CASCADE                                             |                                      |
| `tipo`                      | VARCHAR(30)   | NOT NULL, CHECK IN (`stock`, `gastos`, `productividad`, `eficiencia`, `ganancias`, `otro`) | Tipo de informe. |
| `parametros`                | JSONB         | default `'{}'`                                                              | Filtros aplicados.                   |
| `resultado`                 | JSONB         | default `'{}'`                                                              | Datos agregados.                     |
| `fecha_generacion`          | TIMESTAMPTZ   | NOT NULL, default NOW()                                                     |                                      |
| `generado_por_usuario_id`   | UUID          | FK → usuarios_internos, ON DELETE SET NULL                                  | NULL si lo generó el agente.         |
| `generado_por_agente`       | BOOLEAN       | NOT NULL, default FALSE                                                     | Marca de auditoría.                  |

### 4.14 `agente_conversaciones`

| Campo                | Tipo          | Restricciones                                            | Descripción                          |
|----------------------|---------------|----------------------------------------------------------|--------------------------------------|
| `id`                 | UUID          | PK                                                       |                                      |
| `tenant_id`          | UUID          | NOT NULL, FK → tenants, CASCADE                          | Aislamiento.                         |
| `usuario_interno_id` | UUID          | FK → usuarios_internos, ON DELETE SET NULL               | Quién inició la conversación.        |
| `titulo`             | VARCHAR(200)  | nullable                                                 | Resumen autogenerado.                |
| `created_at`         | TIMESTAMPTZ   | NOT NULL, default NOW()                                  |                                      |
| `updated_at`         | TIMESTAMPTZ   | NOT NULL, default NOW() (trigger)                        | Última actividad.                    |

### 4.15 `agente_mensajes`

| Campo            | Tipo          | Restricciones                                                  | Descripción                            |
|------------------|---------------|----------------------------------------------------------------|----------------------------------------|
| `id`             | UUID          | PK                                                             |                                        |
| `conversacion_id`| UUID          | NOT NULL, FK → agente_conversaciones, CASCADE                  |                                        |
| `rol`            | VARCHAR(20)   | NOT NULL, CHECK IN (`user`, `assistant`, `tool`)               | Quién emitió el mensaje.               |
| `contenido`      | TEXT          | nullable                                                       | Texto del mensaje.                     |
| `tool_calls`     | JSONB         | nullable                                                       | Llamadas a skills del assistant.       |
| `skill_invocada` | VARCHAR(120)  | nullable                                                       | Atajo: última skill invocada.          |
| `timestamp`      | TIMESTAMPTZ   | NOT NULL, default NOW()                                        |                                        |

### 4.16 `agente_skills_log`

| Campo              | Tipo          | Restricciones                                       | Descripción                            |
|--------------------|---------------|-----------------------------------------------------|----------------------------------------|
| `id`               | UUID          | PK                                                  |                                        |
| `conversacion_id`  | UUID          | FK → agente_conversaciones, ON DELETE SET NULL      |                                        |
| `skill_nombre`     | VARCHAR(120)  | NOT NULL                                            | Ej. `crear_tarea`.                     |
| `input`            | JSONB         | default `'{}'`                                      | Params con los que se llamó.           |
| `output`           | JSONB         | default `'{}'`                                      | Resultado devuelto.                    |
| `duracion_ms`      | INTEGER       | default 0                                           | Latencia.                              |
| `exito`            | BOOLEAN       | NOT NULL, default TRUE                              |                                        |
| `error`            | TEXT          | nullable                                            | Mensaje si `exito=FALSE`.              |
| `timestamp`        | TIMESTAMPTZ   | NOT NULL, default NOW()                             |                                        |

### 4.17 `agente_rag_documentos`

| Campo              | Tipo           | Restricciones                                                                                     | Descripción                              |
|--------------------|----------------|---------------------------------------------------------------------------------------------------|------------------------------------------|
| `id`               | UUID           | PK                                                                                                |                                          |
| `tenant_id`        | UUID           | NOT NULL, FK → tenants, CASCADE                                                                   |                                          |
| `origen`           | VARCHAR(20)    | NOT NULL, CHECK IN (`tarea`, `material`, `ubicacion`, `usuario`, `informe`, `manual`)             | Tipo de origen indexado.                 |
| `origen_id`        | UUID           | nullable                                                                                          | Id del registro origen.                  |
| `contenido_texto`  | TEXT           | NOT NULL                                                                                          | Texto a embeddir.                        |
| `metadata`         | JSONB          | default `'{}'`                                                                                    | Datos libres.                            |
| `embedding`        | vector(768)    | NOT NULL                                                                                          | pgvector. No gestionado por Directus.    |
| `created_at`       | TIMESTAMPTZ    | NOT NULL, default NOW()                                                                           |                                          |

UNIQUE `(tenant_id, origen, origen_id)` — upsert controlado.

> **Nota**: la columna `embedding vector(768)` **no** está en el snapshot YAML
> de Directus (no soporta tipo vector). Se crea vía SQL en
> `directus/migrations/001_initial_schema.sql`. El AI Service la gestiona vía
> SQL nativo (no via API de Directus).

### 4.18 `directus_users` (extendida)

Directus gestiona esta tabla internamente. ENTERAR.ME añade:

| Campo       | Tipo | Restricciones                              | Descripción                                |
|-------------|------|--------------------------------------------|--------------------------------------------|
| `tenant_id` | UUID | nullable, FK → tenants, ON DELETE SET NULL | Para filtrado por rol. NULL = super-admin. |

---

## 5. Reglas multitenant

### 5.1 Aislamiento por `tenant_id`

Toda colección operacional (sección 2.2) y de agente IA (sección 2.3) lleva
`tenant_id NOT NULL` con FK `ON DELETE CASCADE` a `tenants`. Borrar un tenant
elimina en cascada todos sus datos.

### 5.2 Permisos Directus (declarativos)

Para el rol `tenant_admin` (UUID `a1111111-…`), el snapshot define permisos
con `validation`:

```yaml
permissions:
  - collection: tareas
    action: read
    validation:
      tenant_id:
        _eq: $CURRENT_USER.tenant_id
  - collection: tareas
    action: create
    validation:
      tenant_id:
        _eq: $CURRENT_USER.tenant_id
```

Esto hace que Directus **rechace** cualquier create/update/delete/read donde
el `tenant_id` del registro no coincida con el del usuario autenticado.

El rol `trabajador` (`b2222222-…`) tiene el mismo filtro pero con permisos
limitados (solo read en algunas colecciones, no puede gestionar usuarios internos, etc.).

### 5.3 Validación en hooks (defensa en profundidad)

Incluso si un usuario malicioso bypasea los permisos (p.ej. referenciando
una FK de otro tenant en un create), el hook
`directus/extensions/hooks/validar-orden-creacion/index.ts` comprueba:

- `usuarios_externos.ubicacion_id` → debe existir y pertenecer al mismo `tenant_id`.
- `usuarios_internos.directus_user_id` → debe tener el mismo `tenant_id`.
- `materiales.usuario_externo_id` → debe existir en el mismo tenant.
- `materiales.organization_id` → debe ser igual a `tenant_id` (no a otro tenant).
- `tareas.ubicacion_id`, `tareas.usuario_externo_id`, `tareas.usuario_interno_id`,
  `tareas.material_ids[]` → todos deben pertenecer al mismo `tenant_id`.

Si algo falla, lanza `InvalidPayloadError` con mensaje claro (rollback automático).

### 5.4 Tenant_id en el AI Service

El AI Service nunca confía en el `tenant_id` del body. Lo extrae **del JWT**:

```typescript
// ai/src/auth.ts
app.decorate("authenticate", async (req, reply) => {
  await req.jwtVerify();
  if (!req.user.tenant_id) return reply.code(403).send({ error: "no tenant" });
});
```

Y lo inyecta en cada llamada a Directus desde las skills (`ctx.tenant_id`).

---

## 6. Trazabilidad

La trazabilidad es **la regla de negocio más importante** de ENTERAR.ME:
*toda variable interviniente en una tarea queda registrada con ubicación + momento*.

### 6.1 Dos orígenes complementarios

| Origen              | Cuándo se escribe                                                | Tabla             |
|---------------------|------------------------------------------------------------------|-------------------|
| Cambios en tareas   | Hook `items.create`/`items.update` AFTER sobre `tareas`          | `eventos_tarea`   |
| Movimientos de stock| Hook `items.create` AFTER sobre `movimientos_stock` con tarea_id | `eventos_tarea`   |
| (el propio movimiento es ya trazabilidad) | —                                | `movimientos_stock` |

### 6.2 Tipos de evento en `eventos_tarea`

| Tipo               | Cuándo se genera                                                        |
|--------------------|-------------------------------------------------------------------------|
| `nota`             | Creación de tarea o cualquier cambio no clasificado (con diff en payload)|
| `inicio`           | `tareas.estado` pasa a `en_progreso`                                    |
| `pausa`            | `tareas.estado` pasa de `en_progreso` a `pendiente`                     |
| `reanudacion`      | (Reservado — el hook actual emite `inicio` de nuevo)                    |
| `fin`              | `tareas.estado` pasa a `completada`                                     |
| `material_usado`   | Cambio en `material_ids` (M2M) o movimiento de stock con `tarea_id`     |
| `cambio_ubicacion` | Cambio de `tareas.ubicacion_id`                                         |

### 6.3 Best-effort

El hook `registrar-trazabilidad` es **best-effort**: si falla el INSERT en
`eventos_tarea` (p.ej. FK inválida, timeout de DB), el error se loguea pero
la operación principal (crear tarea, mover stock) **no se revierte**. Esto
garantiza que el negocio nunca se bloquea por el log.

### 6.4 Reconstrucción de un proceso

Dada una `tarea_id`, se puede reconstruir todo el timeline con:

```sql
SELECT tipo, payload, timestamp, ubicacion_id, usuario_interno_id
FROM eventos_tarea
WHERE tarea_id = $1
ORDER BY timestamp ASC;
```

Y combinarlo con movimientos de stock:

```sql
SELECT 'movimiento' AS origen, tipo, cantidad, timestamp, ubicacion_id
FROM movimientos_stock
WHERE tarea_id = $1
UNION ALL
SELECT 'evento' AS origen, tipo, NULL, timestamp, ubicacion_id
FROM eventos_tarea
WHERE tarea_id = $1
ORDER BY timestamp ASC;
```

La skill `consultar_trazabilidad` del agente IA hace exactamente esto y lo
devuelve como JSON ordenado (ver `AGENTE-RAG-SKILLS.md`).

---

## 7. Índices y optimizaciones

### 7.1 Índices B-tree (búsqueda por FK y filtros comunes)

Creados en `directus/migrations/001_initial_schema.sql`:

```sql
-- Tenants y suscripciones
CREATE INDEX idx_tenants_plan_id          ON tenants(plan_id);
CREATE INDEX idx_tenants_estado           ON tenants(estado);
CREATE INDEX idx_suscripciones_tenant_id  ON suscripciones(tenant_id);
CREATE INDEX idx_suscripciones_estado     ON suscripciones(estado);

-- Operacional (siempre tenant_id primero para multitenant)
CREATE INDEX idx_ubicaciones_tenant_id         ON ubicaciones(tenant_id);
CREATE INDEX idx_usuarios_externos_tenant_id   ON usuarios_externos(tenant_id);
CREATE INDEX idx_usuarios_externos_ubicacion_id ON usuarios_externos(ubicacion_id);
CREATE INDEX idx_usuarios_internos_tenant_id   ON usuarios_internos(tenant_id);
CREATE INDEX idx_materiales_tenant_id          ON materiales(tenant_id);
CREATE INDEX idx_materiales_usuario_externo_id ON materiales(usuario_externo_id);
CREATE INDEX idx_materiales_sku                ON materiales(sku);
CREATE INDEX idx_stocks_tenant_id              ON stocks(tenant_id);
CREATE INDEX idx_stocks_ubicacion_id           ON stocks(ubicacion_id);
CREATE INDEX idx_stocks_material_id            ON stocks(material_id);
CREATE INDEX idx_tareas_tenant_id              ON tareas(tenant_id);
CREATE INDEX idx_tareas_ubicacion_id           ON tareas(ubicacion_id);
CREATE INDEX idx_tareas_usuario_externo_id     ON tareas(usuario_externo_id);
CREATE INDEX idx_tareas_usuario_interno_id     ON tareas(usuario_interno_id);
CREATE INDEX idx_tareas_estado                 ON tareas(estado);
CREATE INDEX idx_movimientos_tenant_id         ON movimientos_stock(tenant_id);
CREATE INDEX idx_movimientos_tarea_id          ON movimientos_stock(tarea_id);
CREATE INDEX idx_movimientos_ubicacion_id      ON movimientos_stock(ubicacion_id);
CREATE INDEX idx_movimientos_material_id       ON movimientos_stock(material_id);
CREATE INDEX idx_movimientos_timestamp         ON movimientos_stock(timestamp);
CREATE INDEX idx_eventos_tarea_id              ON eventos_tarea(tarea_id);
CREATE INDEX idx_eventos_ubicacion_id          ON eventos_tarea(ubicacion_id);
CREATE INDEX idx_eventos_timestamp             ON eventos_tarea(timestamp);
CREATE INDEX idx_eventos_tipo                  ON eventos_tarea(tipo);
CREATE INDEX idx_informes_tenant_id            ON informes(tenant_id);
CREATE INDEX idx_informes_tipo                 ON informes(tipo);
CREATE INDEX idx_informes_fecha                ON informes(fecha_generacion);
```

### 7.2 Índices parciales

```sql
-- Alertas de stock bajo
CREATE INDEX idx_stocks_bajo_umbral
  ON stocks(cantidad)
  WHERE cantidad <= umbral_alerta;
```

### 7.3 pgvector (RAG)

```sql
-- Búsqueda coseno sobre embeddings de 768 dimensiones
CREATE INDEX idx_agente_rag_embedding
  ON agente_rag_documentos
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

`lists = 100` es un buen valor por defecto para ~100k vectores por tenant.
Para volúmenes mayores, subir a `lists = sqrt(rows)` y reindexar.

### 7.4 Búsqueda full-text trigram

```sql
CREATE INDEX idx_agente_rag_contenido_trgm
  ON agente_rag_documentos
  USING gin (contenido_texto gin_trgm_ops);
```

Permite `ILIKE '%texto%'` rápido en el contenido RAG.

### 7.5 Triggers

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at automático en conversaciones
CREATE TRIGGER trg_agente_conversaciones_updated_at
  BEFORE UPDATE ON agente_conversaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- fecha_actualizacion automática en stocks
CREATE TRIGGER trg_stocks_fecha_actualizacion
  BEFORE UPDATE ON stocks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 7.6 Extensiones Postgres

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector (vector(768))
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- ILIKE rápido
```

---

## 8. Aplicación del esquema

```bash
# Opción A: vía Directus (recomendada — incluye permisos y meta)
npx directus schema apply ./directus/snapshots/schema-snapshot.yaml

# Opción B: vía SQL plano (no incluye permisos Directus)
psql "$DATABASE_URL" -f ./directus/migrations/001_initial_schema.sql

# Seeds
npx directus seed:import -s ./directus/seed/superadmin.json
npx directus seed:import -s ./directus/seed/planes.json
npx directus seed:import -s ./directus/seed/marketplace-sectores.json
```

> El snapshot YAML define colecciones + campos + relaciones + permisos + meta.
> La migración SQL define además pgvector, pg_trgm, índices ivfflat/GIN y triggers
> que Directus no gestiona. En producción, aplicar ambos en este orden.

---

## 9. Referencias

- `directus/snapshots/schema-snapshot.yaml` — 21 colecciones, 41 relaciones, 80 permisos.
- `directus/migrations/001_initial_schema.sql` — DDL equivalente con pgvector + índices.
- `directus/seed/superadmin.json` — roles fijos + admin@enterarme.me.
- `directus/seed/planes.json` — Starter / Pro / Enterprise.
- `directus/seed/marketplace-sectores.json` — 4 sectores + 11 plantillas.
- `directus/extensions/hooks/validar-orden-creacion/index.ts` — validación multitenant.
- `directus/extensions/hooks/registrar-trazabilidad/index.ts` — generación de eventos.
- `ai/src/rag/vector-store.ts` — operaciones pgvector del RAG.

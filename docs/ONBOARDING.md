# Onboarding — ENTERAR.ME

Documento de referencia de los flujos de onboarding del SaaS **ENTERAR.ME**:

1. **Onboarding automático de un tenant** (los 6 pasos que pidió el usuario).
2. **Onboarding del super admin** (creación del primer `admin@enterarme.me`).
3. **Onboarding de un sector** (instalación de plantillas del marketplace).
4. **Onboarding de un usuario interno adicional** (lo hace el admin del tenant).

> Implementación principal:
> `directus/extensions/endpoints/enterarme-onboarding/index.ts`
> Flows complementarios: `directus/flows/onboarding-tenant.json`,
> `directus/flows/auto-stock-app.json`, `directus/flows/marketplace-instalacion.json`.

---

## 1. Onboarding automático de un tenant

### 1.1 Los 6 pasos (regla de negocio)

Al crear un tenant, el endpoint `POST /onboarding/tenant` ejecuta atómicamente:

1. **Ubicación "Sede central"** (tipo `sede`, activa).
2. **Usuario externo = la propia empresa** (`tipo = empresa_propia`, ligado a la sede).
3. **Usuario interno = admin del tenant** (rol `admin`, ligado al `directus_user` creado).
4. **Material no fungible = "App ENTERAR.ME"** (asignado al usuario externo empresa propia y al tenant).
5. **Tarea "Configurar app"** (asignada a Sede central + usuario externo empresa propia).
6. **Tarea "Incluir en stock de Sede central el material no fungible App ENTERAR.ME"**.

> Añadidos por la implementación real (fuera de los 6 pasos del usuario pero
> necesarios para que el tenant sea operativo):
>
> - Creación del `tenant` propiamente dicho (con `plan_id` y `estado='trial'`).
> - Creación de la `suscripciones` (estado `activa`, `proxima_factura` en +30 días).
> - Asegurar que existen los roles `tenant_admin` y `trabajador` (UUIDs fijos).
> - Creación del `directus_user` (admin del tenant) con bcrypt password.
> - Instalación opcional de plantillas del `sector_id` si se pasó el parámetro.
> - Registro de eventos de trazabilidad en `eventos_tarea` para las 2 tareas.

Total real: **10 pasos** dentro de una transacción knex.

### 1.2 Diagrama de secuencia

```
[Super Admin Panel]            [Directus]                  [Postgres]
   │                               │                            │
   │ 1. POST /onboarding/tenant    │                            │
   │   Authorization: Bearer       │                            │
   │     <DIRECTUS_SERVICE_TOKEN>  │                            │
   │   Body: { nombre, slug,       │                            │
   │            plan_id,            │                            │
   │            admin_email,        │                            │
   │            admin_password,     │                            │
   │            sector_id? }        │                            │
   ├──────────────────────────────►│                            │
   │                               │ 2. Verifica service token  │
   │                               │ 3. Valida body (zod-like)  │
   │                               │ 4. BEGIN TRANSACTION        │
   │                               ├───────────────────────────►│
   │                               │                            │
   │                               │ 5. SELECT plan WHERE id=$1 │
   │                               │    AND activo=true         │
   │                               ├───────────────────────────►│
   │                               │◄───────────────────────────┤
   │                               │ 6. SELECT tenant WHERE     │
   │                               │    slug=$2 (unique check)  │
   │                               ├───────────────────────────►│
   │                               │◄───────────────────────────┤
   │                               │                            │
   │                               │ 7. INSERT INTO tenants     │
   │                               │    (estado='trial')        │
   │                               ├───────────────────────────►│
   │                               │◄──── tenant_id ────────────┤
   │                               │                            │
   │                               │ 8. INSERT INTO suscripciones│
   │                               │    (estado='activa',       │
   │                               │     proxima_factura=+30d)  │
   │                               ├───────────────────────────►│
   │                               │                            │
   │                               │ 9. INSERT INTO directus_roles│
   │                               │    IF NOT EXISTS           │
   │                               │    (tenant_admin, trabajador)│
   │                               ├───────────────────────────►│
   │                               │                            │
   │                               │ 10. UsersService.createOne │
   │                               │     (FUERA de la trx knex, │
   │                               │      para que hashee bcrypt)│
   │                               │     email, password, role= │
   │                               │       tenant_admin,        │
   │                               │     tenant_id = tenant_id  │
   │                               ├───────────────────────────►│
   │                               │◄──── admin_user_id ────────┤
   │                               │                            │
   │                               │ 11. INSERT INTO ubicaciones│
   │                               │     (Sede central)         │
   │                               ├───────────────────────────►│
   │                               │◄──── ubicacion_sede_id ────┤
   │                               │                            │
   │                               │ 12. INSERT INTO            │
   │                               │     usuarios_externos      │
   │                               │     (tipo=empresa_propia)  │
   │                               ├───────────────────────────►│
   │                               │◄──── usuario_externo_id ───┤
   │                               │                            │
   │                               │ 13. INSERT INTO            │
   │                               │     usuarios_internos      │
   │                               │     (rol=admin, ligado al  │
   │                               │      directus_user)        │
   │                               ├───────────────────────────►│
   │                               │◄──── usuario_interno_id ───┤
   │                               │                            │
   │                               │ 14. INSERT INTO materiales │
   │                               │     (App ENTERAR.ME,       │
   │                               │      tipo=no_fungible,     │
   │                               │      sku=ENTERARME-APP)    │
   │                               ├───────────────────────────►│
   │                               │◄──── material_app_id ──────┤
   │                               │                            │
   │                               │ 15. INSERT INTO tareas     │
   │                               │     (Configurar app)       │
   │                               ├───────────────────────────►│
   │                               │◄──── tarea_configurar_id ──┤
   │                               │                            │
   │                               │ 16. INSERT INTO tareas     │
   │                               │     (Incluir en stock…)    │
   │                               ├───────────────────────────►│
   │                               │◄──── tarea_stock_id ───────┤
   │                               │                            │
   │                               │ 17. INSERT INTO            │
   │                               │     eventos_tarea (×2)     │
   │                               │     tipo=nota,             │
   │                               │     payload.evento=        │
   │                               │       'tarea_creada_por_   │
   │                               │        onboarding'         │
   │                               ├───────────────────────────►│
   │                               │                            │
   │                               │ 18. (Si sector_id) Para    │
   │                               │      cada plantilla activa │
   │                               │      del sector:           │
   │                               │      - INSERT instalaciones│
   │                               │        _mercado             │
   │                               │      - Aplicar según tipo: │
   │                               │        · material → INSERT │
   │                               │          materiales         │
   │                               │        · tarea → INSERT     │
   │                               │          tareas             │
   │                               │        · usuario → INSERT   │
   │                               │          usuarios_externos  │
   │                               │        · pipeline/addon →  │
   │                               │          UPDATE tenants     │
   │                               │          configuracion      │
   │                               ├───────────────────────────►│
   │                               │                            │
   │                               │ 19. COMMIT TRANSACTION     │
   │                               ├───────────────────────────►│
   │                               │                            │
   │                               │ 20. 201 Created            │
   │                               │     JSON con los 9 IDs     │
   │                               │     + plantillas_instaladas│
   │◄──────────────────────────────┤                            │
   │                                                            │
   │ 21. Super Admin redirige a /tenants/[id]                  │
   │     y muestra el detalle con KPIs                         │
```

### 1.3 Cómo invocarlo

**Requisitos previos**:

- El plan `plan_id` debe existir y estar activo (`planes.activo = true`).
- El `slug` debe ser único en `tenants.slug`.
- El `admin_email` no debe existir en `directus_users`.
- `admin_password` debe tener al menos 8 caracteres.
- Si se pasa `sector_id`, el sector debe existir y estar activo.

**curl**:

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

**Respuesta 201 Created**:

```json
{
  "tenant_id": "abc12345-...",
  "admin_user_id": "def67890-...",
  "rol_admin_id": "a1111111-1111-1111-1111-111111111111",
  "rol_trabajador_id": "b2222222-2222-2222-2222-222222222222",
  "ubicacion_sede_id": "...",
  "usuario_externo_id": "...",
  "usuario_interno_id": "...",
  "material_app_id": "...",
  "tarea_configurar_id": "...",
  "tarea_stock_id": "...",
  "plantillas_instaladas": [
    { "plantilla_id": "dd440000-...-001", "nombre": "Detergente industrial (10L)", "tipo": "material" },
    { "plantilla_id": "dd440000-...-002", "nombre": "Limpieza rutina diaria", "tipo": "tarea" }
  ]
}
```

**Errores típicos**:

| HTTP | Código                    | Causa                                                          |
|------|---------------------------|----------------------------------------------------------------|
| 400  | `invalid_payload`         | Faltan campos o `admin_password < 8` chars.                    |
| 400  | `onboarding_failed`       | Plan no existe, slug duplicado, email ya registrado, sector inválido. |
| 401  | `unauthorized`            | Service token incorrecto o ausente.                            |
| 500  | `agent_chat_failed`       | Error inesperado en la transacción (ver logs).                 |

### 1.4 Qué pasa si falla a mitad

El endpoint usa una **transacción knex** para los pasos 7–18. Si cualquiera
de esos pasos falla, se hace `ROLLBACK` automático y no queda ningún registro
operacional (ubicaciones, usuarios, materiales, tareas) en la BD.

**Excepción conocida (documentada en el código del endpoint)**:

El paso 10 (`UsersService.createOne` para crear el `directus_user`) **no se
puede meter dentro de la transacción knex** porque `UsersService` usa su
propia conexión y no acepta una trx externa. Por tanto:

- Si falla algo **antes** del paso 10 → no hay rastro (rollback limpio).
- Si falla algo **después** del paso 10 → la transacción hace rollback de
  los pasos 11–18, **pero el `directus_user` queda creado huérfano** (sin
  tenant, sin usuario interno asociado).

**Mitigación**:

- En caso de error post-paso 10, el endpoint loguea el `admin_user_id` para
  que un operador pueda borrarlo manualmente:

  ```sql
  DELETE FROM directus_users WHERE id = '<admin_user_id>';
  ```

- Próxima mejora: envolver el `UsersService.createOne` en un try/catch y,
  si la trx falla después, ejecutar `UsersService.deleteOne(adminUserId)`.

### 1.5 Instalación de plantillas del sector (sub-flow)

Cuando se pasa `sector_id`, el endpoint itera sobre todas las plantillas
activas del sector y aplica cada una según su `tipo`:

| `tipo`      | Acción                                                                                 |
|-------------|----------------------------------------------------------------------------------------|
| `material`  | INSERT en `materiales` con la `configuracion` (nombre, tipo, sku, unidad, costo).      |
| `tarea`     | INSERT en `tareas` con la `configuracion` (titulo, descripcion, prioridad).            |
| `usuario`   | INSERT en `usuarios_externos` (si `cfg.tipo != 'empresa_propia'`, que ya existe).      |
| `pipeline`  | UPDATE de `tenants.configuracion` con la plantilla embebida bajo clave `plantilla_<id>`.|
| `addon`     | Igual que `pipeline`.                                                                  |

En todos los casos se hace INSERT en `instalaciones_mercado` (log de
auditoría con estado `instalada`).

### 1.6 Flow de respaldo `auto-stock-app`

El flow `directus/flows/auto-stock-app.json` es un **respaldo** del endpoint:
se dispara cuando se crea una tarea con `titulo = 'Configurar app'` y
asegura que exista la segunda tarea "Incluir en stock…". Útil si el
onboarding se hace por otra vía (alta manual de la primera tarea).

No es necesario si el onboarding se hace vía `POST /onboarding/tenant`
(el endpoint ya crea ambas tareas en la misma transacción).

---

## 2. Onboarding del super admin

El super admin es el usuario interno de ENTERAR.ME que gestiona tenants,
planes y marketplace desde `admin.enterarme.me`.

### 2.1 Creación del primer `admin@enterarme.me`

El entrypoint del contenedor Directus crea automáticamente el primer
usuario admin con `ADMIN_EMAIL` y `ADMIN_PASSWORD` (variables de entorno).

```bash
# Variables en Coolify/Railway (.env):
ADMIN_EMAIL=admin@enterarme.me
ADMIN_PASSWORD=<password-seguro>
```

Este usuario se crea con el rol built-in `super-admin` (admin_access=true,
no necesita filas de permiso en `directus_permissions`).

### 2.2 Aplicar el seed de roles

Después del primer arranque, aplicar el seed para crear los roles
`tenant_admin` y `trabajador` con UUIDs fijos (referenciados por el
snapshot y por el endpoint de onboarding):

```bash
# Dentro del contenedor Directus:
npx directus seed:import -s ./seed/superadmin.json
```

Este seed también intenta crear `admin@enterarme.me` si no existe (con
password `admin123` — solo para dev; en prod, sobrescribir o usar el
creado por el entrypoint).

### 2.3 Verificación

```bash
# Login en el panel super admin
curl -X POST https://api.enterarme.me/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enterarme.me","password":"<tu-password>"}'
# → { "data": { "access_token": "...", "expires": 900, "refresh_token": "..." } }
```

Y luego entrar en `https://admin.enterarme.me/login`.

---

## 3. Onboarding de un sector (instalación marketplace)

Un **sector** (`sectores_mercado`) agrupa plantillas reutilizables
(`plantillas_mercado`) por vertical (Construcción, Hostelería, Taller
mecánico, Limpieza).

### 3.1 Cuándo se "instala" un sector en un tenant

Hay dos vías:

**Vía A — Automática en el alta del tenant**:

Se pasa `sector_id` en el `POST /onboarding/tenant`. El endpoint aplica
todas las plantillas activas del sector (ver sección 1.5).

**Vía B — Posterior, desde el panel tenant-admin**:

El admin del tenant entra en `Marketplace` (panel super-admin en
lectura) o en `Configuración → Marketplace` (tenant-admin si el plan lo
permite) y selecciona plantillas individuales.

Internamente, esto dispara un INSERT en `instalaciones_mercado` y, vía
el flow `directus/flows/marketplace-instalacion.json`, se aplica la
plantilla según su tipo (igual que la vía A pero una a una).

### 3.2 Plantillas disponibles en el seed

`directus/seed/marketplace-sectores.json` define 4 sectores con 11 plantillas:

| Sector                 | Plantillas                                                                |
|------------------------|---------------------------------------------------------------------------|
| Construcción y reformas| Andamio (material), Revisión inicial de obra (tarea), Alta de obra (pipeline)|
| Hostelería             | Aceite de cocina 5L (material), Apertura de local (tarea), Alta de local con cocina (pipeline)|
| Taller mecánico        | Aceite motor 5W30 (material), Revisión ITV (tarea), Recepción de vehículo (pipeline)|
| Limpieza profesional   | Detergente industrial 10L (material), Limpieza rutina diaria (tarea)      |

### 3.3 Cómo añadir un nuevo sector/plantilla

1. Desde el panel super-admin → `Marketplace → Sectores → Nuevo`.
2. Rellenar nombre, slug, descripción, icono (Material Symbols).
3. Añadir plantillas en `Marketplace → Plantillas`:
   - `sector_id`: el sector recién creado.
   - `nombre`: visible en el marketplace.
   - `tipo`: `material` / `tarea` / `pipeline` / `addon` / `usuario`.
   - `configuracion`: JSON con los campos que se aplicarán.
   - `version`: semver.
   - `activa`: boolean.

Ejemplo de `configuracion` para un material:

```json
{
  "nombre": "Papel higiénico industrial (24 ud)",
  "tipo": "fungible",
  "sku": "PAPEL-HIG-IND-24",
  "unidad": "ud",
  "costo_unitario": 14.20,
  "metadata": { "categoria": "higiene", "paquete": 24 }
}
```

---

## 4. Onboarding de un usuario interno adicional

El admin del tenant puede crear más usuarios internos (trabajadores,
gestores, consultores) desde `Configuración → Usuarios`.

### 4.1 Pasos

1. **Admin del tenant** entra en `https://<slug>.app.enterarme.me/configuracion`.
2. Click en **"Nuevo usuario"**.
3. Rellena: nombre, email, password, rol (`admin` / `gestor` / `trabajador` /
   `consultor`), ubicación principal (opcional).
4. El frontend hace `POST /api/usuarios-internos` al BFF del tenant-admin.
5. El BFF:
   - Crea el `directus_user` vía `POST /users` a Directus con el token de
     servicio y el `tenant_id` del admin actual.
   - Crea el `usuarios_internos` vía `POST /items/usuarios_internos` con
     `directus_user_id` recién creado, `tenant_id`, rol y ubicación_principal_id.
6. El hook `validar-orden-creacion` valida que `directus_user_id.tenant_id == tenant_id`
   y que `ubicacion_principal_id` pertenece al tenant.
7. El nuevo usuario ya puede loguearse en `https://<slug>.app.enterarme.me/login`
   con sus credenciales y verá los datos filtrados a su tenant.

### 4.2 curl equivalente

```bash
# 1. Crear directus_user (admin del tenant lo hace con su access_token)
DIRECTUS_TOKEN="<access_token_admin_tenant>"
NEW_USER_ID=$(curl -s -X POST https://api.enterarme.me/users \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "María",
    "last_name": "López",
    "email": "maria@acme.es",
    "password": "Acme2024!",
    "role": "b2222222-2222-2222-2222-222222222222",
    "tenant_id": "<tenant_id>",
    "status": "active"
  }' | jq -r .data.id)

# 2. Crear usuario_interno
curl -X POST https://api.enterarme.me/items/usuarios_internos \
  -H "Authorization: Bearer $DIRECTUS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"<tenant_id>\",
    \"directus_user_id\": \"$NEW_USER_ID\",
    \"nombre\": \"María López\",
    \"rol\": \"trabajador\",
    \"ubicacion_principal_id\": \"<ubicacion_id>\"
  }"
```

> El permiso para crear `directus_users` con `tenant_id` está restringido
> al rol `tenant_admin`. Los `trabajador` no pueden crear usuarios.

### 4.3 Límites por plan

Antes de crear un usuario interno, comprobar el límite del plan:

```sql
SELECT p.max_usuarios,
       (SELECT COUNT(*) FROM usuarios_internos ui WHERE ui.tenant_id = $1) AS actuales
FROM tenants t
JOIN planes p ON p.id = t.plan_id
WHERE t.id = $1;
```

Si `actuales >= max_usuarios` (y `max_usuarios != -1`) → rechazar con error
`plan_limit_reached`. Esta validación puede implementarse en un hook o en el BFF.

---

## 5. Referencias

- `directus/extensions/endpoints/enterarme-onboarding/index.ts` — endpoint principal.
- `directus/extensions/endpoints/enterarme-agent/index.ts` — no aplica a onboarding, pero es el otro endpoint custom del proyecto.
- `directus/flows/onboarding-tenant.json` — flow manual (respaldo del endpoint).
- `directus/flows/auto-stock-app.json` — flow event-triggered (respaldo de la 2ª tarea).
- `directus/flows/marketplace-instalacion.json` — flow event-triggered para instalación posterior.
- `directus/seed/superadmin.json` — roles fijos + admin@enterarme.me.
- `directus/seed/planes.json` — Starter / Pro / Enterprise.
- `directus/seed/marketplace-sectores.json` — 4 sectores + 11 plantillas.
- `apps/super-admin/src/app/(panel)/tenants/new/page.tsx` — UI del alta de tenant.
- `apps/super-admin/src/app/api/tenants/[id]/onboarding/route.ts` — BFF que llama al endpoint.
- `apps/tenant-admin/src/app/(panel)/configuracion/page.tsx` — UI de gestión de usuarios internos.

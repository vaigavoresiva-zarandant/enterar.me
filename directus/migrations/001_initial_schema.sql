-- ============================================================
-- ENTERAR.ME — Migración inicial del schema (PostgreSQL 16)
-- ------------------------------------------------------------
-- Aplicar con:
--   psql "$DATABASE_URL" -f migrations/001_initial_schema.sql
--
-- Esta migración es equivalente al snapshot de Directus pero
-- expresada en SQL plano, para entornos donde se prefiere
-- migrar manualmente en vez de aplicar el snapshot.
--
-- Incluye:
--   * Extensión pgvector para embeddings (vector(768))
--   * Todas las tablas operacionales con UUID PK
--   * FKs con ON DELETE CASCADE / SET NULL / RESTRICT según modelo
--   * Índices GIN para búsqueda full-text y para embeddings (ivfflat)
--   * Índices B-tree en tenant_id + ubicacion_id + timestamps
-- ============================================================

-- ---------- Extensiones ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector (vector(768))
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- ILIKE rápido

-- ============================================================
-- PLATAFORMA / MULTITENANT
-- ============================================================

CREATE TABLE IF NOT EXISTS planes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          VARCHAR(120) NOT NULL,
    precio_mensual  NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_usuarios    INTEGER NOT NULL DEFAULT -1,
    max_ubicaciones INTEGER NOT NULL DEFAULT -1,
    max_materiales  INTEGER NOT NULL DEFAULT -1,
    caracteristicas JSONB DEFAULT '{}'::jsonb,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    sort            INTEGER
);

CREATE TABLE IF NOT EXISTS tenants (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre         VARCHAR(200) NOT NULL,
    slug           VARCHAR(100) NOT NULL UNIQUE,
    plan_id        UUID REFERENCES planes(id) ON DELETE SET NULL,
    estado         VARCHAR(20) NOT NULL DEFAULT 'trial',
    dominio        VARCHAR(255) UNIQUE,
    fecha_alta     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    configuracion  JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT tenants_estado_chk CHECK (estado IN ('activo','trial','suspendido','inactivo'))
);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_id ON tenants(plan_id);
CREATE INDEX IF NOT EXISTS idx_tenants_estado  ON tenants(estado);

CREATE TABLE IF NOT EXISTS suscripciones (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES planes(id) ON DELETE RESTRICT,
    estado          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    fecha_inicio    DATE,
    fecha_fin       DATE,
    metodo_pago     VARCHAR(60),
    proxima_factura DATE,
    CONSTRAINT suscripciones_estado_chk CHECK (estado IN ('activa','pendiente','suspendida','cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_suscripciones_tenant_id ON suscripciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suscripciones_estado    ON suscripciones(estado);

CREATE TABLE IF NOT EXISTS sectores_mercado (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      VARCHAR(120) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    icono       VARCHAR(60),
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    sort        INTEGER
);

CREATE TABLE IF NOT EXISTS plantillas_mercado (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sector_id     UUID NOT NULL REFERENCES sectores_mercado(id) ON DELETE CASCADE,
    nombre        VARCHAR(160) NOT NULL,
    tipo          VARCHAR(30) NOT NULL DEFAULT 'material',
    configuracion JSONB DEFAULT '{}'::jsonb,
    version       VARCHAR(20) DEFAULT '1.0.0',
    activa        BOOLEAN NOT NULL DEFAULT TRUE,
    sort          INTEGER,
    CONSTRAINT plantillas_tipo_chk CHECK (tipo IN ('addon','pipeline','material','tarea','usuario'))
);
CREATE INDEX IF NOT EXISTS idx_plantillas_sector_id ON plantillas_mercado(sector_id);
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo      ON plantillas_mercado(tipo);

CREATE TABLE IF NOT EXISTS instalaciones_mercado (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    plantilla_id UUID NOT NULL REFERENCES plantillas_mercado(id) ON DELETE RESTRICT,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado       VARCHAR(20) NOT NULL DEFAULT 'instalada',
    CONSTRAINT instalaciones_estado_chk CHECK (estado IN ('instalada','pendiente','fallida'))
);
CREATE INDEX IF NOT EXISTS idx_instalaciones_tenant_id    ON instalaciones_mercado(tenant_id);
CREATE INDEX IF NOT EXISTS idx_instalaciones_plantilla_id ON instalaciones_mercado(plantilla_id);

-- ============================================================
-- OPERACIONAL DEL TENANT (multitenant estricto)
-- ============================================================

CREATE TABLE IF NOT EXISTS ubicaciones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre         VARCHAR(160) NOT NULL,
    tipo           VARCHAR(20) NOT NULL DEFAULT 'sede',
    direccion      TEXT,
    lat            NUMERIC(9,6),
    lng            NUMERIC(9,6),
    activa         BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ubicaciones_tipo_chk CHECK (tipo IN ('sede','obra','taller','local','otro'))
);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_tenant_id ON ubicaciones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_activa   ON ubicaciones(activa);

CREATE TABLE IF NOT EXISTS usuarios_externos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre        VARCHAR(200) NOT NULL,
    tipo          VARCHAR(20) NOT NULL DEFAULT 'cliente',
    email         VARCHAR(255),
    telefono      VARCHAR(40),
    ubicacion_id  UUID REFERENCES ubicaciones(id) ON DELETE SET NULL,
    metadata      JSONB DEFAULT '{}'::jsonb,
    activo        BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT usuarios_externos_tipo_chk CHECK (tipo IN ('cliente','proveedor','empresa_propia'))
);
CREATE INDEX IF NOT EXISTS idx_usuarios_externos_tenant_id   ON usuarios_externos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_externos_ubicacion_id ON usuarios_externos(ubicacion_id);

CREATE TABLE IF NOT EXISTS usuarios_internos (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    directus_user_id       UUID NOT NULL UNIQUE,  -- FK la añade Directus a directus_users(id)
    nombre                 VARCHAR(200) NOT NULL,
    rol                    VARCHAR(20) NOT NULL DEFAULT 'trabajador',
    ubicacion_principal_id UUID REFERENCES ubicaciones(id) ON DELETE SET NULL,
    activo                 BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT usuarios_internos_rol_chk CHECK (rol IN ('admin','gestor','trabajador','consultor'))
);
CREATE INDEX IF NOT EXISTS idx_usuarios_internos_tenant_id        ON usuarios_internos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_internos_ubicacion_principal_id ON usuarios_internos(ubicacion_principal_id);

-- directus_users.tenant_id (lo crea Directus al importar el snapshot, pero lo añadimos aquí también)
-- Hacemos ADD COLUMN IF NOT EXISTS para no romper si ya existe.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name='directus_users' AND column_name='tenant_id'
    ) THEN
        ALTER TABLE directus_users ADD COLUMN tenant_id UUID;
        ALTER TABLE directus_users
            ADD CONSTRAINT directus_users_tenant_id_fk
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
    END IF;
END$$;

-- Ahora sí añadimos la FK de usuarios_internos.directus_user_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname='usuarios_internos_directus_user_id_fk'
    ) THEN
        ALTER TABLE usuarios_internos
            ADD CONSTRAINT usuarios_internos_directus_user_id_fk
            FOREIGN KEY (directus_user_id) REFERENCES directus_users(id) ON DELETE CASCADE;
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS materiales (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    nombre            VARCHAR(200) NOT NULL,
    tipo              VARCHAR(20) NOT NULL DEFAULT 'fungible',
    sku               VARCHAR(60),
    unidad            VARCHAR(20) DEFAULT 'ud',
    costo_unitario    NUMERIC(12,2) DEFAULT 0,
    usuario_externo_id UUID REFERENCES usuarios_externos(id) ON DELETE SET NULL,
    organization_id   UUID REFERENCES tenants(id) ON DELETE SET NULL,
    metadata          JSONB DEFAULT '{}'::jsonb,
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT materiales_tipo_chk CHECK (tipo IN ('fungible','no_fungible'))
);
CREATE INDEX IF NOT EXISTS idx_materiales_tenant_id          ON materiales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_materiales_usuario_externo_id ON materiales(usuario_externo_id);
CREATE INDEX IF NOT EXISTS idx_materiales_sku                ON materiales(sku);

CREATE TABLE IF NOT EXISTS stocks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ubicacion_id      UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE CASCADE,
    material_id       UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
    cantidad          NUMERIC(14,2) NOT NULL DEFAULT 0,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    umbral_alerta     NUMERIC(14,2) DEFAULT 0,
    UNIQUE (ubicacion_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_stocks_tenant_id     ON stocks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stocks_ubicacion_id  ON stocks(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_stocks_material_id   ON stocks(material_id);
CREATE INDEX IF NOT EXISTS idx_stocks_bajo_umbral   ON stocks(cantidad) WHERE cantidad <= umbral_alerta;

CREATE TABLE IF NOT EXISTS tareas (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ubicacion_id        UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
    usuario_externo_id  UUID NOT NULL REFERENCES usuarios_externos(id) ON DELETE RESTRICT,
    usuario_interno_id  UUID REFERENCES usuarios_internos(id) ON DELETE SET NULL,
    titulo              VARCHAR(255) NOT NULL,
    descripcion         TEXT,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    prioridad           VARCHAR(20) NOT NULL DEFAULT 'media',
    fecha_asignacion    TIMESTAMPTZ DEFAULT NOW(),
    fecha_inicio        TIMESTAMPTZ,
    fecha_fin           TIMESTAMPTZ,
    duracion_minutos    INTEGER DEFAULT 0,
    costo_total         NUMERIC(14,2) DEFAULT 0,
    metadata            JSONB DEFAULT '{}'::jsonb,
    CONSTRAINT tareas_estado_chk    CHECK (estado    IN ('pendiente','en_progreso','completada','cancelada')),
    CONSTRAINT tareas_prioridad_chk CHECK (prioridad IN ('baja','media','alta','urgente'))
);
CREATE INDEX IF NOT EXISTS idx_tareas_tenant_id          ON tareas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tareas_ubicacion_id       ON tareas(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_tareas_usuario_externo_id ON tareas(usuario_externo_id);
CREATE INDEX IF NOT EXISTS idx_tareas_usuario_interno_id ON tareas(usuario_interno_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado             ON tareas(estado);

-- Junction M2M tareas ↔ materiales
CREATE TABLE IF NOT EXISTS tareas_materiales (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarea_id    UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES materiales(id) ON DELETE CASCADE,
    cantidad    NUMERIC(14,2) DEFAULT 1,
    UNIQUE (tarea_id, material_id)
);
CREATE INDEX IF NOT EXISTS idx_tareas_materiales_tarea_id    ON tareas_materiales(tarea_id);
CREATE INDEX IF NOT EXISTS idx_tareas_materiales_material_id ON tareas_materiales(material_id);

CREATE TABLE IF NOT EXISTS movimientos_stock (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    stock_id          UUID REFERENCES stocks(id) ON DELETE SET NULL,
    tipo              VARCHAR(20) NOT NULL DEFAULT 'entrada',
    cantidad          NUMERIC(14,2) NOT NULL DEFAULT 0,
    motivo            VARCHAR(255),
    tarea_id          UUID REFERENCES tareas(id) ON DELETE SET NULL,
    ubicacion_id      UUID NOT NULL REFERENCES ubicaciones(id) ON DELETE RESTRICT,
    material_id       UUID NOT NULL REFERENCES materiales(id) ON DELETE RESTRICT,
    usuario_interno_id UUID REFERENCES usuarios_internos(id) ON DELETE SET NULL,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT movimientos_tipo_chk CHECK (tipo IN ('entrada','salida','ajuste'))
);
CREATE INDEX IF NOT EXISTS idx_movimientos_tenant_id     ON movimientos_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_stock_id      ON movimientos_stock(stock_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_tarea_id      ON movimientos_stock(tarea_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_ubicacion_id  ON movimientos_stock(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_material_id   ON movimientos_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_timestamp     ON movimientos_stock(timestamp);

CREATE TABLE IF NOT EXISTS eventos_tarea (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarea_id          UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    tipo              VARCHAR(30) NOT NULL DEFAULT 'nota',
    payload           JSONB DEFAULT '{}'::jsonb,
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario_interno_id UUID REFERENCES usuarios_internos(id) ON DELETE SET NULL,
    ubicacion_id      UUID REFERENCES ubicaciones(id) ON DELETE SET NULL,
    CONSTRAINT eventos_tipo_chk CHECK (tipo IN ('inicio','pausa','reanudacion','fin','material_usado','nota','cambio_ubicacion'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_tarea_id          ON eventos_tarea(tarea_id);
CREATE INDEX IF NOT EXISTS idx_eventos_ubicacion_id      ON eventos_tarea(ubicacion_id);
CREATE INDEX IF NOT EXISTS idx_eventos_timestamp         ON eventos_tarea(timestamp);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo              ON eventos_tarea(tipo);

CREATE TABLE IF NOT EXISTS informes (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id              UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo                   VARCHAR(30) NOT NULL DEFAULT 'otro',
    parametros             JSONB DEFAULT '{}'::jsonb,
    resultado              JSONB DEFAULT '{}'::jsonb,
    fecha_generacion       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generado_por_usuario_id UUID REFERENCES usuarios_internos(id) ON DELETE SET NULL,
    generado_por_agente    BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT informes_tipo_chk CHECK (tipo IN ('stock','gastos','productividad','eficiencia','ganancias','otro'))
);
CREATE INDEX IF NOT EXISTS idx_informes_tenant_id    ON informes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_informes_tipo         ON informes(tipo);
CREATE INDEX IF NOT EXISTS idx_informes_fecha        ON informes(fecha_generacion);

-- ============================================================
-- AGENTE IA
-- ============================================================

CREATE TABLE IF NOT EXISTS agente_conversaciones (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usuario_interno_id UUID REFERENCES usuarios_internos(id) ON DELETE SET NULL,
    titulo             VARCHAR(200),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agente_conversaciones_tenant_id ON agente_conversaciones(tenant_id);

CREATE TABLE IF NOT EXISTS agente_mensajes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES agente_conversaciones(id) ON DELETE CASCADE,
    rol             VARCHAR(20) NOT NULL DEFAULT 'user',
    contenido       TEXT,
    tool_calls      JSONB,
    skill_invocada  VARCHAR(120),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agente_mensajes_rol_chk CHECK (rol IN ('user','assistant','tool'))
);
CREATE INDEX IF NOT EXISTS idx_agente_mensajes_conversacion_id ON agente_mensajes(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_agente_mensajes_timestamp      ON agente_mensajes(timestamp);

CREATE TABLE IF NOT EXISTS agente_skills_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID REFERENCES agente_conversaciones(id) ON DELETE SET NULL,
    skill_nombre    VARCHAR(120) NOT NULL,
    input           JSONB DEFAULT '{}'::jsonb,
    output          JSONB DEFAULT '{}'::jsonb,
    duracion_ms     INTEGER DEFAULT 0,
    exito           BOOLEAN NOT NULL DEFAULT TRUE,
    error           TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agente_skills_log_conversacion_id ON agente_skills_log(conversacion_id);
CREATE INDEX IF NOT EXISTS idx_agente_skills_log_skill_nombre    ON agente_skills_log(skill_nombre);
CREATE INDEX IF NOT EXISTS idx_agente_skills_log_timestamp       ON agente_skills_log(timestamp);

CREATE TABLE IF NOT EXISTS agente_rag_documentos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    origen          VARCHAR(20) NOT NULL DEFAULT 'manual',
    origen_id       UUID,
    contenido_texto TEXT NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    embedding       vector(768),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT agente_rag_origen_chk CHECK (origen IN ('tarea','material','ubicacion','usuario','informe','manual'))
);
CREATE INDEX IF NOT EXISTS idx_agente_rag_tenant_id   ON agente_rag_documentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agente_rag_origen      ON agente_rag_documentos(origen);
-- Índice ivfflat para búsqueda vectorial (cosine distance).
-- lists=100 es un buen valor por defecto para ~100k vectores.
CREATE INDEX IF NOT EXISTS idx_agente_rag_embedding
    ON agente_rag_documentos USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Índice GIN sobre contenido_texto para búsqueda full-text trigram.
CREATE INDEX IF NOT EXISTS idx_agente_rag_contenido_trgm
    ON agente_rag_documentos USING gin (contenido_texto gin_trgm_ops);

-- ============================================================
-- TRIGGERS: updated_at automático en conversaciones y stocks
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agente_conversaciones_updated_at ON agente_conversaciones;
CREATE TRIGGER trg_agente_conversaciones_updated_at
    BEFORE UPDATE ON agente_conversaciones
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_stocks_fecha_actualizacion ON stocks;
CREATE TRIGGER trg_stocks_fecha_actualizacion
    BEFORE UPDATE ON stocks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- COMENTARIOS
-- ============================================================
COMMENT ON TABLE tenants                 IS 'Inquilinos (organizaciones) del SaaS';
COMMENT ON TABLE planes                  IS 'Planes de suscripción';
COMMENT ON TABLE suscripciones           IS 'Suscripciones de tenants a planes';
COMMENT ON TABLE sectores_mercado        IS 'Sectores del marketplace de plantillas';
COMMENT ON TABLE plantillas_mercado      IS 'Plantillas aplicables a un tenant';
COMMENT ON TABLE instalaciones_mercado   IS 'Log de plantillas instaladas en tenants';
COMMENT ON TABLE ubicaciones             IS 'Ubicaciones físicas del tenant';
COMMENT ON TABLE usuarios_externos       IS 'Clientes / proveedores / empresa propia del tenant';
COMMENT ON TABLE usuarios_internos       IS 'Usuarios internos del tenant ligados a directus_users';
COMMENT ON TABLE materiales              IS 'Materiales / recursos del tenant';
COMMENT ON TABLE stocks                  IS 'Stock por ubicación (material × ubicación)';
COMMENT ON TABLE movimientos_stock       IS 'Movimientos de stock (entrada/salida/ajuste)';
COMMENT ON TABLE tareas                  IS 'Tareas operativas del tenant';
COMMENT ON TABLE tareas_materiales       IS 'Junction M2M tareas ↔ materiales';
COMMENT ON TABLE eventos_tarea           IS 'Trazabilidad total (ubicación + momento)';
COMMENT ON TABLE informes                IS 'Informes del tenant (stock, gastos, etc.)';
COMMENT ON TABLE agente_conversaciones   IS 'Conversaciones del agente IA';
COMMENT ON TABLE agente_mensajes         IS 'Mensajes de las conversaciones';
COMMENT ON TABLE agente_skills_log       IS 'Log de ejecuciones de skills';
COMMENT ON TABLE agente_rag_documentos   IS 'Base de conocimiento RAG (con embeddings vector(768))';

-- ============================================================
-- FIN
-- ============================================================

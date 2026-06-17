/**
 * src/db.ts
 * Pool de Postgres reutilizable (compartido con Directus).
 *
 * Tablas asumidas (creadas por Directus + extensión pgvector):
 *  - agente_rag_documentos(id, tenant_id, origen, origen_id, contenido_texto,
 *                          metadata jsonb, embedding vector(768), created_at)
 *  - agente_conversaciones(id uuid, tenant_id, usuario_id, created_at, updated_at)
 *  - agente_mensajes(id uuid, conversacion_id, role, content, metadata jsonb, created_at)
 *  - agente_skills_log(id uuid, tenant_id, conversacion_id, skill, params jsonb,
 *                      result jsonb, error text, duration_ms int, created_at)
 *
 * La extensión `pgvector` y las tablas deben crearse en la migración de Directus.
 */
import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/** Comprueba la conexión al arrancar */
export async function assertDbConnection(): Promise<void> {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
  } finally {
    if (client) client.release();
  }
}

/** Cierra el pool (para tests / shutdown limpio) */
export async function closeDb(): Promise<void> {
  await pool.end();
}

/** Wrapper para transacciones simples */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

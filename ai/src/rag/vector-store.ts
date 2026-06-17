/**
 * src/rag/vector-store.ts
 * Operaciones contra la tabla `agente_rag_documentos` en Postgres (pgvector).
 *
 * DDL asumido (creado por la migración de Directus):
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE TABLE agente_rag_documentos (
 *     id bigserial PRIMARY KEY,
 *     tenant_id uuid NOT NULL,
 *     origen text NOT NULL,           -- 'ubicacion' | 'usuario_externo' | ...
 *     origen_id text NOT NULL,        -- id del registro origen
 *     contenido_texto text NOT NULL,
 *     metadata jsonb NOT NULL DEFAULT '{}',
 *     embedding vector(768) NOT NULL,
 *     created_at timestamptz NOT NULL DEFAULT now(),
 *     UNIQUE (tenant_id, origen, origen_id)
 *   );
 *   CREATE INDEX ON agente_rag_documentos USING ivfflat (embedding vector_cosine_ops);
 *   CREATE INDEX ON agente_rag_documentos (tenant_id, origen, origen_id);
 */
import { pool } from "../db.js";
import { embedText } from "./embeddings.js";

export interface RagDocument {
  tenant_id: string;
  origen: string;
  origen_id: string;
  contenido_texto: string;
  metadata?: Record<string, unknown>;
}

export interface RagSearchHit {
  id: number;
  origen: string;
  origen_id: string;
  contenido_texto: string;
  metadata: Record<string, unknown>;
  score: number; // similitud coseno (1 - distancia)
}

const VECTOR_DIM = 768;

/** Convierte un array de números al literal pgvector '[0.1,0.2,...]' */
function toPgVector(vec: number[]): string {
  return `[${vec.map((n) => Number(n).toFixed(6)).join(",")}]`;
}

/** Comprueba que el vector tenga la dimensión esperada */
function assertDim(vec: number[]): void {
  if (vec.length !== VECTOR_DIM) {
    throw new Error(
      `Embedding con dimensión ${vec.length}, se esperaba ${VECTOR_DIM}. ` +
        `Verifica que el modelo de embeddings sea nomic-embed-text.`
    );
  }
}

/**
 * Indexa (o reemplaza) un documento RAG para un tenant.
 * Si ya existe (mismo tenant+origen+origen_id), se actualiza.
 */
export async function index(doc: RagDocument): Promise<{ id: number; replaced: boolean }> {
  const embedding = await embedText(doc.contenido_texto);
  assertDim(embedding);

  const vecLit = toPgVector(embedding);
  const metadata = JSON.stringify(doc.metadata ?? {});

  const res = await pool.query<{ id: number; insert_mode: boolean }>(
    `INSERT INTO agente_rag_documentos
        (tenant_id, origen, origen_id, contenido_texto, metadata, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector)
     ON CONFLICT (tenant_id, origen, origen_id)
     DO UPDATE SET contenido_texto = EXCLUDED.contenido_texto,
                   metadata        = EXCLUDED.metadata,
                   embedding       = EXCLUDED.embedding
     RETURNING id, (xmax = 0) AS insert_mode`,
    [doc.tenant_id, doc.origen, doc.origen_id, doc.contenido_texto, metadata, vecLit]
  );

  const row = res.rows[0];
  if (!row) throw new Error("index: no se devolvió fila");
  return {
    id: row.id,
    replaced: !row.insert_mode,
  };
}

/** Busca los k documentos más similares (coseno) dentro de un tenant. */
export async function search(
  tenant_id: string,
  query: string,
  k = 5
): Promise<RagSearchHit[]> {
  const embedding = await embedText(query);
  assertDim(embedding);

  const vecLit = toPgVector(embedding);

  // <=> distancia coseno. score = 1 - distancia.
  const res = await pool.query<{
    id: number;
    origen: string;
    origen_id: string;
    contenido_texto: string;
    metadata: Record<string, unknown>;
    distancia: number;
  }>(
    `SELECT id, origen, origen_id, contenido_texto, metadata,
            embedding <=> $2::vector AS distancia
     FROM agente_rag_documentos
     WHERE tenant_id = $1
     ORDER BY distancia ASC
     LIMIT $3`,
    [tenant_id, vecLit, k]
  );

  return res.rows.map((r) => ({
    id: r.id,
    origen: r.origen,
    origen_id: r.origen_id,
    contenido_texto: r.contenido_texto,
    metadata: r.metadata ?? {},
    score: 1 - Number(r.distancia),
  }));
}

/** Elimina los documentos de un origen concreto (para reindexación o baja). */
export async function deleteByOrigin(
  tenant_id: string,
  origen: string,
  origen_id: string
): Promise<number> {
  const res = await pool.query(
    `DELETE FROM agente_rag_documentos
     WHERE tenant_id = $1 AND origen = $2 AND origen_id = $3`,
    [tenant_id, origen, origen_id]
  );
  return res.rowCount ?? 0;
}

/** Elimina todos los documentos de un tenant (para purgar tenant). */
export async function deleteByTenant(tenant_id: string): Promise<number> {
  const res = await pool.query(
    "DELETE FROM agente_rag_documentos WHERE tenant_id = $1",
    [tenant_id]
  );
  return res.rowCount ?? 0;
}

/**
 * src/rag/retriever.ts
 * Recupera contexto RAG y lo formatea para inyectar en el prompt del LLM.
 */
import { config } from "../config.js";
import { search, type RagSearchHit } from "./vector-store.js";

export interface RetrievedChunk extends RagSearchHit {}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  contextText: string;
}

/**
 * Recupera los k chunks más relevantes para una query dentro de un tenant
 * y los formatea como contexto textual para el LLM.
 */
export async function retrieve(
  tenant_id: string,
  query: string,
  k = config.RAG_TOP_K
): Promise<RetrievalResult> {
  const hits = await search(tenant_id, query, k);

  if (hits.length === 0) {
    return { chunks: [], contextText: "" };
  }

  const contextText = hits
    .map((h, i) => {
      const meta = Object.entries(h.metadata)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      return `### Contexto ${i + 1} (${h.origen}:${h.origen_id}, score=${h.score.toFixed(
        3
      )}${meta ? `, ${meta}` : ""})\n${h.contenido_texto}`;
    })
    .join("\n\n");

  return { chunks: hits, contextText };
}

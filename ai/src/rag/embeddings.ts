/**
 * src/rag/embeddings.ts
 * Embeddings de texto vía Ollama (nomic-embed-text, 768-d).
 */
import { ollamaClient } from "../ollama-client.js";

export async function embedText(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error("embedText: el texto no puede estar vacío");
  }
  // Truncamos a 4000 chars para no disparar coste y evitar prompts excesivos
  const truncated = text.length > 4000 ? text.slice(0, 4000) : text;
  return ollamaClient.embed(truncated);
}

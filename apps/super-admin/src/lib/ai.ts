/**
 * Cliente del servicio IA (Ollama vía ai/).
 * El servicio IA expone rutas REST para el agente global del super-admin.
 *
 * IMPORTANTE: el SDK de IA (z-ai-web-dev-sdk) se usa SOLO dentro del
 * servicio IA, no aquí. Aquí solo hacemos fetch HTTP al servicio.
 */

const AI_URL = process.env.AI_URL || process.env.NEXT_PUBLIC_AI_URL || "http://localhost:3030";
const SERVICE_TOKEN = process.env.DIRECTUS_SERVICE_TOKEN || "";

export interface AgentSkill {
  name: string;
  description: string;
}

export interface AgentMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  skill?: string | null;
}

export interface AgentStreamChunk {
  delta?: string;
  skill?: string;
  done?: boolean;
  error?: string;
}

/** Lista de skills disponibles en el agente */
export async function listSkills(): Promise<AgentSkill[]> {
  try {
    const res = await fetch(`${AI_URL}/skills`, {
      headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: AgentSkill[] };
    return data.data ?? [];
  } catch (err) {
    console.error("[ai.listSkills]", err);
    return [];
  }
}

/**
 * Inicia una conversación con el agente IA global.
 * Devuelve un async iterable de chunks (streaming SSE-like).
 */
export async function* streamAgentChat(
  input: {
    conversation_id?: string;
    messages: AgentMessage[];
    scope?: "tenant" | "global";
  },
  signal?: AbortSignal,
): AsyncIterable<AgentStreamChunk> {
  const res = await fetch(`${AI_URL}/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_TOKEN}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      conversation_id: input.conversation_id,
      messages: input.messages,
      scope: input.scope ?? "global",
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    yield { error: `HTTP ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Procesa líneas SSE (data: {...}\n\n)
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of rawEvent.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            yield { done: true };
            return;
          }
          try {
            yield JSON.parse(payload) as AgentStreamChunk;
          } catch {
            // línea no JSON, ignorar
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Crea una conversación nueva con el agente */
export async function createConversation(title?: string): Promise<string | null> {
  try {
    const res = await fetch(`${AI_URL}/agent/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_TOKEN}`,
      },
      body: JSON.stringify({ title: title ?? "Nueva conversación", scope: "global" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { id?: string } };
    return data.data?.id ?? null;
  } catch (err) {
    console.error("[ai.createConversation]", err);
    return null;
  }
}

/** Lista conversaciones globales del super-admin */
export async function listConversations(limit = 30) {
  try {
    const res = await fetch(
      `${AI_URL}/agent/conversations?scope=global&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
        cache: "no-store",
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id: string; title?: string; date_updated?: string }> };
    return data.data ?? [];
  } catch (err) {
    console.error("[ai.listConversations]", err);
    return [];
  }
}

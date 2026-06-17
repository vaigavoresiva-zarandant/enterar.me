/**
 * src/ollama-client.ts
 * Wrapper sobre el cliente npm `ollama` con reintentos, timeout y soporte para
 * Railway (cold start). Funciones:
 *  - chat(model, messages, tools?)
 *  - embed(text)
 *  - pullModel(name)
 */
import { setTimeout as sleep } from "node:timers/promises";
import { Ollama } from "ollama";
import { config } from "./config.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  // Ollama (formato nuevo) admite imágenes y tool_calls:
  images?: string[];
  tool_calls?: ToolCall[];
  // Para role=tool
  tool_call_id?: string | null;
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

export interface ChatResult {
  content: string;
  tool_calls?: ToolCall[];
  done: boolean;
  eval_count?: number;
  total_duration_ms?: number;
}

class OllamaClient {
  private client: Ollama;
  private readonly apiKey: string;

  constructor() {
    const baseUrl = config.OLLAMA_HOST;
    // El cliente npm `ollama` usa fetch; inyectamos Authorization si hay API key
    // (típico para un proxy delante de Ollama en Railway).
    this.apiKey = config.OLLAMA_API_KEY;
    this.client = new Ollama({
      host: baseUrl,
      fetch: this.apiKey
        ? (input: string | URL | Request, init?: RequestInit) =>
            fetch(input, {
              ...init,
              headers: {
                ...(init?.headers as Record<string, string> | undefined ?? {}),
                Authorization: `Bearer ${this.apiKey}`,
              },
            })
        : undefined,
    });
  }

  /** Chat con reintentos (Railway puede tener cold start) */
  async chat(
    messages: ChatMessage[],
    opts: { tools?: ToolDef[]; model?: string } = {}
  ): Promise<ChatResult> {
    const model = opts.model ?? config.OLLAMA_MODEL;
    const maxRetries = config.OLLAMA_MAX_RETRIES;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat({
          model,
          messages: messages as never, // el tipo del cliente es más laxo
          tools: opts.tools as never,
          stream: false,
          options: {
            temperature: 0.3,
            num_ctx: 8192,
          },
        });

        const message = response.message ?? { content: "" };
        const toolCalls = (message as { tool_calls?: ToolCall[] }).tool_calls;

        return {
          content: message.content ?? "",
          tool_calls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
          done: response.done,
          eval_count: response.eval_count,
          total_duration_ms: response.total_duration
            ? Math.round(response.total_duration / 1_000_000)
            : undefined,
        };
      } catch (err) {
        lastErr = err;
        const waitMs = Math.min(1000 * 2 ** attempt, 8000);
        // eslint-disable-next-line no-console
        console.warn(
          `[ollama] chat attempt ${attempt}/${maxRetries} failed:`,
          err instanceof Error ? err.message : err,
          `→ retrying in ${waitMs}ms`
        );
        await sleep(waitMs);
      }
    }

    throw new Error(
      `ollama.chat falló tras ${maxRetries} intentos: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`
    );
  }

  /** Embeddings con nomic-embed-text → vector 768-d */
  async embed(text: string, model?: string): Promise<number[]> {
    const embedModel = model ?? config.OLLAMA_EMBED_MODEL;
    const maxRetries = config.OLLAMA_MAX_RETRIES;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.embeddings({
          model: embedModel,
          prompt: text,
        });
        if (!response.embedding || response.embedding.length === 0) {
          throw new Error("embedding vacío");
        }
        return response.embedding;
      } catch (err) {
        lastErr = err;
        const waitMs = Math.min(1000 * 2 ** attempt, 8000);
        // eslint-disable-next-line no-console
        console.warn(
          `[ollama] embed attempt ${attempt}/${maxRetries} failed:`,
          err instanceof Error ? err.message : err
        );
        await sleep(waitMs);
      }
    }

    throw new Error(
      `ollama.embed falló tras ${maxRetries} intentos: ${
        lastErr instanceof Error ? lastErr.message : String(lastErr)
      }`
    );
  }

  /** Descarga un modelo (para bootstrap del servicio) */
  async pullModel(name: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[ollama] pullModel: ${name} (esto puede tardar varios minutos)…`);
    const stream = await this.client.pull({ model: name, stream: true });
    for await (const chunk of stream) {
      if (chunk.status) {
        // eslint-disable-next-line no-console
        console.log(`[ollama] pull ${name}: ${chunk.status}${
          chunk.completed && chunk.total ? ` ${chunk.completed}/${chunk.total}` : ""
        }`);
      }
    }
  }

  /** Comprueba que el modelo configurado está disponible */
  async ensureModel(name: string = config.OLLAMA_MODEL): Promise<void> {
    try {
      const list = await this.client.list();
      const exists = list.models?.some((m) => m.name === name || m.name.startsWith(name + ":"));
      if (!exists) {
        // eslint-disable-next-line no-console
        console.warn(`[ollama] modelo "${name}" no encontrado. Ejecuta: ollama create ${name} -f Modelfile`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[ollama] no se pudo listar modelos:", err instanceof Error ? err.message : err);
    }
  }
}

export const ollamaClient = new OllamaClient();

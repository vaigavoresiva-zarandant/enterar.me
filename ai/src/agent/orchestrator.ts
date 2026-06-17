/**
 * src/agent/orchestrator.ts
 * Orquestador del agente ENTERAR.ME.
 *
 * Flujo por cada mensaje del usuario:
 *   1. Recupera contexto RAG con retriever (filtrado por tenant).
 *   2. Llama a Ollama con historial + system prompt + tools.
 *   3. Si hay tool_calls → ejecuta skills (con try/catch, persiste en agente_skills_log).
 *   4. Vuelve a llamar a Ollama con el resultado de las tools.
 *   5. Persiste mensaje user y assistant en agente_mensajes.
 *   6. Devuelve { respuesta, skill_invocada, conversacion_id }.
 *
 * Máximo de iteraciones de tool-calling: AGENT_MAX_TOOL_ITERATIONS (default 5).
 */
import { randomUUID } from "node:crypto";
import { pool } from "../db.js";
import { config } from "../config.js";
import { ollamaClient, type ChatMessage, type ToolCall } from "../ollama-client.js";
import { retrieve } from "../rag/retriever.js";
import { getSkill, type SkillContext } from "../skills/index.js";
import { buildTools } from "./tools.js";
import { SYSTEM_PROMPT, formatRagContext } from "./prompts.js";

export interface RunAgentInput {
  tenant_id: string;
  conversacion_id?: string;
  mensaje: string;
  historial?: ChatMessage[];
  usuario_id?: string;
}

export interface RunAgentOutput {
  respuesta: string;
  skill_invocada: string[] | null;
  conversacion_id: string;
  iterations: number;
}

interface PersistedMessage {
  id: string;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Crea o reutiliza una conversación en `agente_conversaciones` */
async function ensureConversation(
  tenant_id: string,
  conversacion_id: string | undefined,
  usuario_id?: string
): Promise<string> {
  if (conversacion_id) {
    // Verificar pertenencia al tenant
    const res = await pool.query<{ id: string }>(
      `SELECT id FROM agente_conversaciones WHERE id = $1 AND tenant_id = $2`,
      [conversacion_id, tenant_id]
    );
    if (res.rows.length > 0) return conversacion_id;
    // si no existe, creamos uno nuevo con ese id
  }
  const id = conversacion_id ?? randomUUID();
  await pool.query(
    `INSERT INTO agente_conversaciones (id, tenant_id, usuario_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, tenant_id, usuario_id ?? null]
  );
  return id;
}

/** Persiste un mensaje en `agente_mensajes` */
async function persistMessage(
  conversacion_id: string,
  role: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<PersistedMessage> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO agente_mensajes (id, conversacion_id, role, content, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, conversacion_id, role, content, metadata ? JSON.stringify(metadata) : null]
  );
  return { id, role, content, metadata };
}

/** Persiste una entrada en `agente_skills_log` */
async function persistSkillLog(
  tenant_id: string,
  conversacion_id: string,
  skill: string,
  params: unknown,
  result: unknown,
  error: string | null,
  durationMs: number
): Promise<void> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO agente_skills_log (id, tenant_id, conversacion_id, skill, params, result, error, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      tenant_id,
      conversacion_id,
      skill,
      JSON.stringify(params),
      result !== undefined ? JSON.stringify(result) : null,
      error,
      durationMs,
    ]
  );
}

/** Ejecuta una skill con manejo de errores y persistencia de log */
async function executeSkillSafe(
  ctx: SkillContext,
  toolCall: ToolCall
): Promise<{ ok: boolean; result: unknown; summary: string; durationMs: number }> {
  const skill = getSkill(toolCall.function.name);
  const start = Date.now();
  if (!skill) {
    const durationMs = Date.now() - start;
    await persistSkillLog(
      ctx.tenant_id,
      ctx.conversacion_id ?? "",
      toolCall.function.name,
      toolCall.function.arguments,
      null,
      `Skill no encontrada: ${toolCall.function.name}`,
      durationMs
    );
    return {
      ok: false,
      result: null,
      summary: `Skill "${toolCall.function.name}" no disponible.`,
      durationMs,
    };
  }

  // Validar params con zod
  const parsed = skill.parameters.safeParse(toolCall.function.arguments);
  if (!parsed.success) {
    const durationMs = Date.now() - start;
    await persistSkillLog(
      ctx.tenant_id,
      ctx.conversacion_id ?? "",
      skill.name,
      toolCall.function.arguments,
      null,
      `Validación zod: ${parsed.error.message}`,
      durationMs
    );
    return {
      ok: false,
      result: null,
      summary: `Parámetros inválidos para "${skill.name}": ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}.`,
      durationMs,
    };
  }

  try {
    const result = await skill.execute(ctx, parsed.data);
    const durationMs = Date.now() - start;
    await persistSkillLog(
      ctx.tenant_id,
      ctx.conversacion_id ?? "",
      skill.name,
      parsed.data,
      result,
      result.ok ? null : result.message,
      durationMs
    );
    return {
      ok: result.ok,
      result,
      summary: result.summary ?? result.message,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    await persistSkillLog(
      ctx.tenant_id,
      ctx.conversacion_id ?? "",
      skill.name,
      parsed.data,
      null,
      errMsg,
      durationMs
    );
    return {
      ok: false,
      result: null,
      summary: `Error ejecutando "${skill.name}": ${errMsg}`,
      durationMs,
    };
  }
}

/** Punto de entrada del orquestador */
export async function runAgent(input: RunAgentInput): Promise<RunAgentOutput> {
  const conversacion_id = await ensureConversation(
    input.tenant_id,
    input.conversacion_id,
    input.usuario_id
  );

  const ctx: SkillContext = {
    tenant_id: input.tenant_id,
    conversacion_id,
    usuario_id: input.usuario_id,
  };

  // 1. RAG
  let ragContext = "";
  try {
    const retrieved = await retrieve(input.tenant_id, input.mensaje);
    ragContext = formatRagContext(retrieved.contextText);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[orchestrator] RAG falló (continuando sin contexto):",
      err instanceof Error ? err.message : err
    );
  }

  // 2. Construir messages
  const tools = buildTools();
  const baseMessages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(input.historial ?? []),
    { role: "user", content: `${ragContext}${input.mensaje}` },
  ];

  // Persistir el mensaje user (sólo el original, sin contexto RAG)
  await persistMessage(conversacion_id, "user", input.mensaje);

  const invokedSkills: string[] = [];
  let iterations = 0;
  let currentMessages = [...baseMessages];
  let lastAssistant = "";

  // 3-4. Bucle de tool-calling
  while (iterations < config.AGENT_MAX_TOOL_ITERATIONS) {
    iterations += 1;
    const result = await ollamaClient.chat(currentMessages, { tools });

    if (result.tool_calls && result.tool_calls.length > 0) {
      // Añadir mensaje assistant con tool_calls al historial
      currentMessages.push({
        role: "assistant",
        content: result.content ?? "",
        tool_calls: result.tool_calls,
      });

      // Ejecutar cada tool y añadir su resultado
      for (const tc of result.tool_calls) {
        invokedSkills.push(tc.function.name);
        const exec = await executeSkillSafe(ctx, tc);
        currentMessages.push({
          role: "tool",
          content: exec.summary,
          tool_call_id: null,
        });
      }

      // Continuar iterando para que el modelo decida si llama más tools o responde
      continue;
    }

    // Sin tool_calls: respuesta final
    lastAssistant = result.content ?? "";
    break;
  }

  if (!lastAssistant) {
    lastAssistant =
      invokedSkills.length > 0
        ? `He ejecutado las siguientes acciones: ${invokedSkills.join(
            ", "
          )}. ¿Necesitas algo más?`
        : "No he podido generar una respuesta. Reinténtalo en unos segundos.";
  }

  // 5. Persistir mensaje assistant
  await persistMessage(conversacion_id, "assistant", lastAssistant, {
    skill_invocada: invokedSkills.length > 0 ? invokedSkills : null,
    iterations,
  });

  return {
    respuesta: lastAssistant,
    skill_invocada: invokedSkills.length > 0 ? invokedSkills : null,
    conversacion_id,
    iterations,
  };
}

/**
 * src/routes/chat.ts
 * POST /chat
 * Body: { conversacion_id?, mensaje }
 * tenant_id se toma del JWT (req.user.tenant_id).
 */
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { z } from "zod";
import { runAgent } from "../agent/orchestrator.js";
import type { ChatMessage } from "../ollama-client.js";

const bodySchema = z.object({
  conversacion_id: z.string().uuid().optional(),
  mensaje: z.string().min(1).max(8000),
  historial: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string(),
        tool_calls: z.array(z.any()).optional(),
        tool_call_id: z.string().nullable().optional(),
      })
    )
    .max(50)
    .optional(),
});

export const chatRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  app.post("/chat", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Body inválido",
        details: parsed.error.issues,
      });
    }

    const { tenant_id, id: usuario_id } = req.user;

    try {
      const result = await runAgent({
        tenant_id,
        conversacion_id: parsed.data.conversacion_id,
        mensaje: parsed.data.mensaje,
        historial: parsed.data.historial as ChatMessage[] | undefined,
        usuario_id,
      });

      return reply.send(result);
    } catch (err) {
      req.log.error(err, "chat: error en runAgent");
      return reply.code(502).send({
        error: "Error procesando el mensaje",
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  });
  done();
};

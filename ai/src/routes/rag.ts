/**
 * src/routes/rag.ts
 * POST /rag/index → fuerza reindexación de un origen en RAG.
 * Lo usa Directus (webhook) tras crear/editar/eliminar registros.
 *
 * Body:
 *   { accion: "index" | "delete", origen, origen_id,
 *     contenido_texto, metadata? }
 */
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { z } from "zod";
import { index, deleteByOrigin } from "../rag/vector-store.js";

const indexSchema = z.object({
  accion: z.literal("index"),
  origen: z.string().min(1).max(60),
  origen_id: z.string().min(1).max(200),
  contenido_texto: z.string().min(1).max(8000),
  metadata: z.record(z.unknown()).optional(),
});

const deleteSchema = z.object({
  accion: z.literal("delete"),
  origen: z.string().min(1).max(60),
  origen_id: z.string().min(1).max(200),
});

const bodySchema = z.discriminatedUnion("accion", [indexSchema, deleteSchema]);

export const ragRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  app.post("/rag/index", async (req, reply) => {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Body inválido",
        details: parsed.error.issues,
      });
    }
    const { tenant_id } = req.user;

    try {
      if (parsed.data.accion === "index") {
        const result = await index({
          tenant_id,
          origen: parsed.data.origen,
          origen_id: parsed.data.origen_id,
          contenido_texto: parsed.data.contenido_texto,
          metadata: parsed.data.metadata,
        });
        return reply.send({ ok: true, ...result });
      }
      const deleted = await deleteByOrigin(
        tenant_id,
        parsed.data.origen,
        parsed.data.origen_id
      );
      return reply.send({ ok: true, deleted });
    } catch (err) {
      req.log.error(err, "rag/index: error");
      return reply.code(500).send({
        error: "Error en reindexación",
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  });
  done();
};

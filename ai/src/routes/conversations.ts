/**
 * src/routes/conversations.ts
 * GET /conversations/:id → historial de mensajes de una conversación.
 * Filtra por tenant_id (del JWT) para evitar acceso cross-tenant.
 */
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { pool } from "../db.js";

export const conversationsRoutes: FastifyPluginCallback = (
  app: FastifyInstance,
  _opts,
  done
) => {
  app.get<{ Params: { id: string } }>(
    "/conversations/:id",
    async (req, reply) => {
      const { id } = req.params;
      const { tenant_id } = req.user;

      // Verificar pertenencia
      const conv = await pool.query<{ id: string }>(
        `SELECT id FROM agente_conversaciones WHERE id = $1 AND tenant_id = $2`,
        [id, tenant_id]
      );
      if (conv.rows.length === 0) {
        return reply.code(404).send({ error: "Conversación no encontrada" });
      }

      const msgs = await pool.query<{
        id: string;
        role: string;
        content: string;
        metadata: Record<string, unknown> | null;
        created_at: string;
      }>(
        `SELECT id, role, content, metadata, created_at
         FROM agente_mensajes
         WHERE conversacion_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      const skillsLog = await pool.query<{
        skill: string;
        params: unknown;
        result: unknown;
        error: string | null;
        duration_ms: number;
        created_at: string;
      }>(
        `SELECT skill, params, result, error, duration_ms, created_at
         FROM agente_skills_log
         WHERE conversacion_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      return reply.send({
        conversacion_id: id,
        mensajes: msgs.rows,
        skills_log: skillsLog.rows,
      });
    }
  );
  done();
};

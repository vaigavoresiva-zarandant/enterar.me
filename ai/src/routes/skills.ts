/**
 * src/routes/skills.ts
 * GET /skills → lista las skills disponibles con su descripción y JSON Schema.
 */
import type { FastifyInstance, FastifyPluginCallback } from "fastify";
import { listSkills } from "../agent/tools.js";

export const skillsRoutes: FastifyPluginCallback = (app: FastifyInstance, _opts, done) => {
  app.get("/skills", async (_req, reply) => {
    return reply.send({ skills: listSkills() });
  });
  done();
};

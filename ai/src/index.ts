/**
 * src/index.ts
 * Punto de entrada del servicio IA de ENTERAR.ME.
 * Levanta Fastify, registra CORS, JWT, rutas y conecta con Ollama/Postgres.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config, corsOrigins } from "./config.js";
import { assertDbConnection, closeDb } from "./db.js";
import { ollamaClient } from "./ollama-client.js";
import { authPlugin } from "./auth.js";
import { chatRoutes } from "./routes/chat.js";
import { skillsRoutes } from "./routes/skills.js";
import { conversationsRoutes } from "./routes/conversations.js";
import { ragRoutes } from "./routes/rag.js";

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === "production" ? "info" : "debug",
    },
    trustProxy: true,
  });

  // ----- CORS -----
  await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });

  // ----- Auth (JWT compartido con Directus) -----
  await app.register(authPlugin);

  // ----- Health (público) -----
  app.get("/health", async (_req, reply) => {
    let dbOk = false;
    let ollamaOk = false;
    try {
      await assertDbConnection();
      dbOk = true;
    } catch {
      /* ignore */
    }
    try {
      // Listar modelos es la forma barata de comprobar Ollama
      await ollamaClient.ensureModel();
      ollamaOk = true;
    } catch {
      /* ignore */
    }
    const status = dbOk && ollamaOk ? "ok" : "degraded";
    const code = status === "ok" ? 200 : 503;
    return reply.code(code).send({
      status,
      service: "enterarme-ai",
      ts: new Date().toISOString(),
      checks: { db: dbOk, ollama: ollamaOk },
      ollama_model: config.OLLAMA_MODEL,
    });
  });

  // ----- Rutas protegidas -----
  // Aplicamos authenticate a todas menos /health
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health" || req.url === "/health/") {
      return; // skipping auth
    }
    await app.authenticate(req, reply);
  });

  await app.register(chatRoutes);
  await app.register(skillsRoutes);
  await app.register(conversationsRoutes);
  await app.register(ragRoutes);

  // ----- Startup -----
  try {
    await assertDbConnection();
    app.log.info("✅ Postgres conectado");
    await ollamaClient.ensureModel();
    app.log.info({ host: config.OLLAMA_HOST, model: config.OLLAMA_MODEL }, "✅ Ollama reachable");
  } catch (err) {
    app.log.warn(
      { err: err instanceof Error ? err.message : err },
      "⚠️  Comprobaciones iniciales fallaron (servicio arrancará de todos modos)."
    );
  }

  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  app.log.info(`🚀 enterarme-ai escuchando en http://0.0.0.0:${config.PORT}`);

  // ----- Shutdown -----
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Cerrando servidor…");
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Fallo arrancando enterarme-ai:", err);
  process.exit(1);
});

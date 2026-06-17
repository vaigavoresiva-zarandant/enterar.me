/**
 * src/config.ts
 * Carga y valida variables de entorno con zod.
 */
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3030),

  // Postgres (compartido con Directus)
  DATABASE_URL: z
    .string()
    .url()
    .refine((u) => u.startsWith("postgres"), "DATABASE_URL debe ser postgres://"),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Ollama (Railway o local)
  OLLAMA_HOST: z.string().url().default("http://localhost:11434"),
  OLLAMA_API_KEY: z.string().optional().default(""),
  OLLAMA_MODEL: z.string().default("enterarme-agent"),
  OLLAMA_EMBED_MODEL: z.string().default("nomic-embed-text"),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  OLLAMA_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  OLLAMA_EMBED_DIM: z.coerce.number().int().positive().default(768),

  // Directus (para que las skills llamen a la API)
  DIRECTUS_URL: z.string().url().default("http://localhost:8055"),
  DIRECTUS_SERVICE_TOKEN: z.string().min(1, "DIRECTUS_SERVICE_TOKEN es obligatorio"),

  // JWT (compartido con Directus: SECRET de Directus)
  JWT_SECRET: z.string().min(8, "JWT_SECRET es obligatorio y debe ser >= 8 chars"),
  JWT_ISSUER: z.string().default("enterarme"),

  // CORS
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001"),

  // Orchestrator
  AGENT_MAX_TOOL_ITERATIONS: z.coerce.number().int().positive().default(5),
  RAG_TOP_K: z.coerce.number().int().positive().default(5),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Variables de entorno inválidas:");
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;

/** Lista de orígenes permitidos para CORS (separados por coma) */
export const corsOrigins = config.CORS_ORIGINS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export type AppConfig = typeof config;

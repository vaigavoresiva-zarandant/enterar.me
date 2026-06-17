/**
 * src/agent/tools.ts
 * Convierte el registro de skills al formato JSON Schema que espera Ollama
 * para function-calling.
 *
 * Ollama admite tools con esta forma:
 *   { type: "function", function: { name, description, parameters: <JSON Schema> } }
 *
 * Convertimos un ZodObject en JSON Schema de forma ligera (sin depender de
 * zod-to-json-schema para evitar otra dependencia). Soportamos:
 *   z.string, z.number, z.boolean, z.enum, z.array, z.object, z.optional, z.union, z.literal, z.default
 */
import { z } from "zod";
import { registry } from "../skills/index.js";
import type { ToolDef } from "../ollama-client.js";

/** Convierte un esquema Zod en JSON Schema (simplificado). */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Desenvolver defaults y optionales
  if (schema instanceof z.ZodDefault) {
    return zodToJsonSchema(schema.removeDefault());
  }
  if (schema instanceof z.ZodOptional) {
    return { ...zodToJsonSchema(schema.unwrap()), optional: true };
  }
  if (schema instanceof z.ZodNullable) {
    return { ...zodToJsonSchema(schema.unwrap()), nullable: true };
  }
  if (schema instanceof z.ZodEffects) {
    return zodToJsonSchema(schema.innerType());
  }

  if (schema instanceof z.ZodString) {
    return { type: "string" };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: "number" };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: "boolean" };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: "string", enum: schema.options };
  }
  if (schema instanceof z.ZodLiteral) {
    const v = schema.value;
    return {
      type: typeof v === "number" ? "number" : typeof v === "boolean" ? "boolean" : "string",
      const: v,
    };
  }
  if (schema instanceof z.ZodArray) {
    return { type: "array", items: zodToJsonSchema(schema.element) };
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(value as z.ZodTypeAny);
      const isOptional =
        value instanceof z.ZodOptional ||
        value instanceof z.ZodDefault ||
        value instanceof z.ZodNullable;
      if (!isOptional) required.push(key);
    }
    return {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
      additionalProperties: false,
    };
  }
  if (schema instanceof z.ZodUnion) {
    // Tomamos la primera opción para el schema (best-effort)
    const opts = schema.options as z.ZodTypeAny[];
    return { anyOf: opts.map((o) => zodToJsonSchema(o)) };
  }
  // Fallback
  return { type: "string" };
}

/** Devuelve la lista de tools en formato Ollama a partir del registro de skills. */
export function buildTools(): ToolDef[] {
  return registry.map((skill) => ({
    type: "function" as const,
    function: {
      name: skill.name,
      description: skill.description,
      parameters: zodToJsonSchema(skill.parameters),
    },
  }));
}

/** Lista simplificada (nombre + descripción) para logs y /skills. */
export function listSkills(): Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}> {
  return registry.map((skill) => ({
    name: skill.name,
    description: skill.description,
    parameters: zodToJsonSchema(skill.parameters),
  }));
}

/**
 * src/skills/_helpers.ts
 * Utilidades comunes para las skills (manejo de errores, validación de ids).
 */
import { DirectusError } from "../directus.js";
import type { SkillResult } from "./types.js";

/** Convierte cualquier error en un SkillResult estándar */
export function toSkillResult(err: unknown, action: string): SkillResult {
  if (err instanceof DirectusError) {
    return {
      ok: false,
      message: `Error al ${action}: ${err.message}`,
      summary: `No se pudo ${action}. Directus respondió ${err.status}: ${err.message}.`,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    ok: false,
    message: `Error inesperado al ${action}: ${msg}`,
    summary: `Error inesperado al ${action}.`,
  };
}

/** id como string|number → string (Directus acepta ambos) */
export function idStr(id: string | number): string {
  return String(id);
}

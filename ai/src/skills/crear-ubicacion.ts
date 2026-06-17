/**
 * src/skills/crear-ubicacion.ts
 * Crea una ubicación en el tenant vía Directus (POST /items/ubicaciones).
 * Las ubicaciones son el primer paso del orden obligatorio de creación.
 */
import { z } from "zod";
import { directus, DirectusError } from "../directus.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.enum(["sede", "obra", "taller", "local", "almacen", "otro"]),
  direccion: z.string().max(500).optional(),
});

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  try {
    const created = await directus.post<{ id: string | number }>(
      "/items/ubicaciones",
      {
        tenant_id: ctx.tenant_id,
        nombre: params.nombre,
        tipo: params.tipo,
        direccion: params.direccion ?? null,
        activo: true,
      }
    );
    return {
      ok: true,
      data: created,
      message: `Ubicación "${params.nombre}" creada`,
      summary: `Ubicación "${params.nombre}" (tipo ${params.tipo}) creada con id ${created.id}.`,
    };
  } catch (err) {
    return handleError(err, "crear ubicación");
  }
}

function handleError(err: unknown, action: string): SkillResult {
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

export const crearUbicacion: Skill = {
  name: "crear_ubicacion",
  description:
    "Crea una ubicación (sede, obra, taller, local, almacén u otro) en el tenant. " +
    "Primer paso del orden obligatorio de creación.",
  parameters,
  execute,
};

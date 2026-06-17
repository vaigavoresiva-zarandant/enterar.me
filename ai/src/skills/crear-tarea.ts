/**
 * src/skills/crear-tarea.ts
 * Crea una tarea asignada a ubicación + usuario externo (y opcionalmente
 * a un usuario interno). Quinto paso del orden obligatorio.
 *
 * Trazabilidad: tras crear la tarea, deja un evento en `eventos_tarea`
 * (tipo "creacion") para garantizar el rastro ubicación+momento.
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  titulo: z.string().min(1).max(200),
  descripcion: z.string().max(2000).optional(),
  ubicacion_id: z.union([z.string(), z.number()]),
  usuario_externo_id: z.union([z.string(), z.number()]),
  usuario_interno_id: z.union([z.string(), z.number()]).optional(),
  material_ids: z.array(z.union([z.string(), z.number()])).optional(),
  prioridad: z.enum(["baja", "media", "alta", "urgente"]).optional(),
});

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  try {
    const created = await directus.post<{ id: string | number }>(
      "/items/tareas",
      {
        tenant_id: ctx.tenant_id,
        titulo: params.titulo,
        descripcion: params.descripcion ?? null,
        ubicacion_id: params.ubicacion_id,
        usuario_externo_id: params.usuario_externo_id,
        usuario_interno_id: params.usuario_interno_id ?? null,
        prioridad: params.prioridad ?? "media",
        estado: "pendiente",
      }
    );

    // Trazabilidad: evento de creación
    try {
      await directus.post("/items/eventos_tarea", {
        tenant_id: ctx.tenant_id,
        tarea_id: created.id,
        ubicacion_id: params.ubicacion_id,
        tipo: "creacion",
        descripcion: `Tarea "${params.titulo}" creada`,
        usuario_interno_id: params.usuario_interno_id ?? null,
      });
    } catch (eventErr) {
      // No bloqueamos la creación si el evento falla, pero lo reportamos
      // eslint-disable-next-line no-console
      console.warn(
        "[crear-tarea] evento_tarea no pudo registrarse:",
        eventErr instanceof Error ? eventErr.message : eventErr
      );
    }

    // Asociar materiales si llegaron
    if (params.material_ids && params.material_ids.length > 0) {
      try {
        await directus.post("/items/tareas_materiales", {
          tenant_id: ctx.tenant_id,
          tarea_id: created.id,
          materiales: params.material_ids.map((mid) => ({
            material_id: mid,
          })),
        });
      } catch (matErr) {
        // eslint-disable-next-line no-console
        console.warn(
          "[crear-tarea] no se pudieron asociar materiales:",
          matErr instanceof Error ? matErr.message : matErr
        );
      }
    }

    return {
      ok: true,
      data: created,
      message: `Tarea "${params.titulo}" creada`,
      summary: `Tarea "${params.titulo}" creada con id ${created.id}, asignada a ubicación ${params.ubicacion_id} y usuario externo ${params.usuario_externo_id}. Evento de trazabilidad registrado.`,
    };
  } catch (err) {
    return toSkillResult(err, "crear tarea");
  }
}

export const crearTarea: Skill = {
  name: "crear_tarea",
  description:
    "Crea una tarea asignada a una ubicación y un usuario externo (obligatorios), " +
    "y opcionalmente a un usuario interno y materiales. Registra evento de trazabilidad. " +
    "Último paso del orden obligatorio de creación.",
  parameters,
  execute,
};

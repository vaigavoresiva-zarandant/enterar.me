/**
 * src/skills/crear-material.ts
 * Crea un material (fungible o no fungible) asignado a un usuario externo
 * y al tenant. Cuarto paso del orden obligatorio.
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.enum(["fungible", "no_fungible"]),
  usuario_externo_id: z.union([z.string(), z.number()]),
  unidad: z.enum(["unidad", "kg", "litro", "metro", "caja", "paquete", "hora", "otro"]).optional(),
  costo_unitario: z.number().nonnegative().optional(),
});

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  try {
    const created = await directus.post<{ id: string | number }>(
      "/items/materiales",
      {
        tenant_id: ctx.tenant_id,
        nombre: params.nombre,
        tipo: params.tipo,
        usuario_externo_id: params.usuario_externo_id,
        unidad: params.unidad ?? "unidad",
        costo_unitario: params.costo_unitario ?? 0,
        activo: true,
      }
    );
    return {
      ok: true,
      data: created,
      message: `Material "${params.nombre}" creado`,
      summary: `Material "${params.nombre}" (${params.tipo}) creado con id ${created.id}, asignado a usuario externo ${params.usuario_externo_id}.`,
    };
  } catch (err) {
    return toSkillResult(err, "crear material");
  }
}

export const crearMaterial: Skill = {
  name: "crear_material",
  description:
    "Crea un material (fungible o no fungible) asignado a un usuario externo y al tenant. " +
    "Requiere que el usuario externo exista (orden obligatorio de creación).",
  parameters,
  execute,
};

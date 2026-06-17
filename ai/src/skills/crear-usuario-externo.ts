/**
 * src/skills/crear-usuario-externo.ts
 * Crea un usuario externo (cliente/proveedor) asignado a una ubicación.
 * Segundo paso del orden obligatorio (requiere ubicación previa).
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  nombre: z.string().min(1).max(200),
  tipo: z.enum(["cliente", "proveedor", "empresa", "otro"]),
  email: z.string().email().optional(),
  ubicacion_id: z.union([z.string(), z.number()]),
});

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  try {
    const created = await directus.post<{ id: string | number }>(
      "/items/usuarios_externos",
      {
        tenant_id: ctx.tenant_id,
        nombre: params.nombre,
        tipo: params.tipo,
        email: params.email ?? null,
        ubicacion_id: params.ubicacion_id,
        activo: true,
      }
    );
    return {
      ok: true,
      data: created,
      message: `Usuario externo "${params.nombre}" creado`,
      summary: `Usuario externo "${params.nombre}" (tipo ${params.tipo}) creado con id ${created.id}, asignado a ubicación ${params.ubicacion_id}.`,
    };
  } catch (err) {
    return toSkillResult(err, "crear usuario externo");
  }
}

export const crearUsuarioExterno: Skill = {
  name: "crear_usuario_externo",
  description:
    "Crea un usuario externo (cliente, proveedor o empresa) asignado a una ubicación. " +
    "Requiere que la ubicación exista (orden obligatorio de creación).",
  parameters,
  execute,
};

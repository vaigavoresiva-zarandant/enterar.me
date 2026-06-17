/**
 * src/skills/crear-usuario-interno.ts
 * Crea un usuario interno (trabajador del tenant) con un rol.
 * Tercer paso del orden obligatorio (requiere ubicación principal previa).
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  directus_user_id: z.string().min(1, "directus_user_id es obligatorio"),
  rol: z.enum(["admin", "gestor", "operario", "lector"]),
  ubicacion_principal_id: z.union([z.string(), z.number()]).optional(),
});

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  try {
    const created = await directus.post<{ id: string | number }>(
      "/items/usuarios_internos",
      {
        tenant_id: ctx.tenant_id,
        directus_user_id: params.directus_user_id,
        rol: params.rol,
        ubicacion_principal_id: params.ubicacion_principal_id ?? null,
        activo: true,
      }
    );
    return {
      ok: true,
      data: created,
      message: `Usuario interno creado con rol ${params.rol}`,
      summary: `Usuario interno (directus_user_id=${params.directus_user_id}, rol=${params.rol}) creado con id ${created.id}.`,
    };
  } catch (err) {
    return toSkillResult(err, "crear usuario interno");
  }
}

export const crearUsuarioInterno: Skill = {
  name: "crear_usuario_interno",
  description:
    "Crea un usuario interno (trabajador del tenant) con un rol. " +
    "Requiere el ID de usuario de Directus (auth) y opcionalmente una ubicación principal.",
  parameters,
  execute,
};

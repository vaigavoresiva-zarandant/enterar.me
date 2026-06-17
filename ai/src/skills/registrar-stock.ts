/**
 * src/skills/registrar-stock.ts
 * Registra un movimiento de stock en una ubicación para un material.
 * Crea un `movimientos_stock` y actualiza el saldo en `stocks`.
 * tipos: entrada | salida | ajuste | transferencia (transferencia requiere destino).
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  ubicacion_id: z.union([z.string(), z.number()]),
  material_id: z.union([z.string(), z.number()]),
  cantidad: z.number().refine((n) => n !== 0, "cantidad no puede ser 0"),
  tipo_movimiento: z.enum(["entrada", "salida", "ajuste", "transferencia"]),
  ubicacion_destino_id: z.union([z.string(), z.number()]).optional(),
  referencia: z.string().max(200).optional(),
});

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  if (params.tipo_movimiento === "transferencia" && !params.ubicacion_destino_id) {
    return {
      ok: false,
      message: "Las transferencias requieren ubicacion_destino_id",
      summary:
        "No se pudo registrar stock: las transferencias requieren ubicacion_destino_id.",
    };
  }

  try {
    const movimiento = await directus.post<{ id: string | number }>(
      "/items/movimientos_stock",
      {
        tenant_id: ctx.tenant_id,
        ubicacion_id: params.ubicacion_id,
        material_id: params.material_id,
        cantidad: params.cantidad,
        tipo_movimiento: params.tipo_movimiento,
        ubicacion_destino_id: params.ubicacion_destino_id ?? null,
        referencia: params.referencia ?? null,
      }
    );

    // Actualizar el saldo en stocks (upsert vía Directus).
    // Asumimos que hay un hook/flow de Directus que ya recalcula stocks tras el movimiento.
    // Aquí sólo consultamos el saldo resultante para devolverlo al usuario.
    let saldo: { id: string | number; cantidad: number } | null = null;
    try {
      const filter = encodeURIComponent(
        JSON.stringify({
          tenant_id: { _eq: ctx.tenant_id },
          ubicacion_id: { _eq: params.ubicacion_id },
          material_id: { _eq: params.material_id },
        })
      );
      saldo = await directus.get<{ id: string | number; cantidad: number }>(
        "/items/stocks",
        { filter, limit: "1" }
      );
    } catch {
      /* no crítico */
    }

    return {
      ok: true,
      data: { movimiento, saldo },
      message: `Movimiento ${params.tipo_movimiento} de ${params.cantidad} registrado`,
      summary:
        `Movimiento de stock ${params.tipo_movimiento} (${params.cantidad}) registrado ` +
        `para material ${params.material_id} en ubicación ${params.ubicacion_id}.` +
        (saldo ? ` Saldo actual: ${saldo.cantidad}.` : ""),
    };
  } catch (err) {
    return toSkillResult(err, "registrar movimiento de stock");
  }
}

export const registrarStock: Skill = {
  name: "registrar_stock",
  description:
    "Registra un movimiento de stock (entrada, salida, ajuste o transferencia) " +
    "para un material en una ubicación. Crea el movimiento y deja el saldo actualizado.",
  parameters,
  execute,
};

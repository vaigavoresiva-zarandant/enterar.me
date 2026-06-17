/**
 * src/skills/consultar-trazabilidad.ts
 * Consulta trazabilidad de un tenant combinando eventos_tarea y movimientos_stock.
 * Devuelve un resumen filtrado por ubicación, usuario, material, tarea y/o fechas.
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parameters = z.object({
  ubicacion_id: z.union([z.string(), z.number()]).optional(),
  usuario_externo_id: z.union([z.string(), z.number()]).optional(),
  material_id: z.union([z.string(), z.number()]).optional(),
  tarea_id: z.union([z.string(), z.number()]).optional(),
  fecha_desde: z.string().datetime().optional(),
  fecha_hasta: z.string().datetime().optional(),
  limite: z.number().int().positive().max(200).optional(),
});

interface TrazabilidadEvento {
  tipo: string;
  fecha: string;
  descripcion: string;
  ubicacion_id: string | number;
  metadata: Record<string, unknown>;
}

interface EventoTareaRaw {
  id: string | number;
  tipo: string;
  descripcion: string | null;
  created_at: string;
  ubicacion_id: string | number;
  tarea_id: string | number | null;
  usuario_interno_id: string | number | null;
}

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  const limit = params.limite ?? 50;
  const filter: Record<string, unknown> = {
    tenant_id: { _eq: ctx.tenant_id },
  };
  if (params.ubicacion_id) filter.ubicacion_id = { _eq: params.ubicacion_id };
  if (params.usuario_externo_id)
    filter.usuario_externo_id = { _eq: params.usuario_externo_id };
  if (params.tarea_id) filter.tarea_id = { _eq: params.tarea_id };

  const dateRange: Record<string, unknown> = {};
  if (params.fecha_desde) dateRange._gte = params.fecha_desde;
  if (params.fecha_hasta) dateRange._lte = params.fecha_hasta;
  if (Object.keys(dateRange).length > 0) filter.created_at = dateRange;

  const filterEventos = encodeURIComponent(JSON.stringify(filter));

  // Filtro para movimientos_stock (no tiene usuario_externo_id directamente)
  const filterStock: Record<string, unknown> = {
    tenant_id: { _eq: ctx.tenant_id },
  };
  if (params.ubicacion_id) filterStock.ubicacion_id = { _eq: params.ubicacion_id };
  if (params.material_id) filterStock.material_id = { _eq: params.material_id };
  if (Object.keys(dateRange).length > 0) filterStock.created_at = dateRange;
  const filterStockEnc = encodeURIComponent(JSON.stringify(filterStock));

  try {
    const fieldsEventos =
      "id,tipo,descripcion,created_at,ubicacion_id,tarea_id,usuario_interno_id";
    const [eventos, movimientos] = await Promise.all([
      directus.get<EventoTareaRaw[]>(
        "/items/eventos_tarea",
        { filter: filterEventos, limit: String(limit), sort: "-created_at", fields: fieldsEventos }
      ),
      directus.get<
        {
          id: string | number;
          tipo_movimiento: string;
          cantidad: number;
          created_at: string;
          ubicacion_id: string | number;
          material_id: string | number;
          referencia: string | null;
        }[]
      >("/items/movimientos_stock", {
        filter: filterStockEnc,
        limit: String(limit),
        sort: "-created_at",
        fields:
          "id,tipo_movimiento,cantidad,created_at,ubicacion_id,material_id,referencia",
      }),
    ]);

    const eventosList = Array.isArray(eventos) ? eventos : [];
    const movList = Array.isArray(movimientos) ? movimientos : [];

    const eventosTrazabilidad: TrazabilidadEvento[] = eventosList.map((e) => ({
      tipo: `tarea:${e.tipo}`,
      fecha: e.created_at,
      descripcion: e.descripcion ?? "",
      ubicacion_id: e.ubicacion_id,
      metadata: { tarea_id: e.tarea_id, usuario_interno_id: e.usuario_interno_id },
    }));

    const stockTrazabilidad: TrazabilidadEvento[] = movList.map((m) => ({
      tipo: `stock:${m.tipo_movimiento}`,
      fecha: m.created_at,
      descripcion: `${m.tipo_movimiento} de ${m.cantidad} (material ${m.material_id})`,
      ubicacion_id: m.ubicacion_id,
      metadata: { material_id: m.material_id, referencia: m.referencia },
    }));

    const combinados = [...eventosTrazabilidad, ...stockTrazabilidad]
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
      .slice(0, limit);

    const summary =
      `Trazabilidad: ${eventosTrazabilidad.length} eventos de tareas y ` +
      `${stockTrazabilidad.length} movimientos de stock (mostrando ${combinados.length}).`;

    return {
      ok: true,
      data: combinados,
      message: summary,
      summary,
    };
  } catch (err) {
    return toSkillResult(err, "consultar trazabilidad");
  }
}

export const consultarTrazabilidad: Skill = {
  name: "consultar_trazabilidad",
  description:
    "Consulta trazabilidad combinada (eventos de tareas + movimientos de stock) " +
    "filtrando por ubicación, usuario externo, material, tarea y/o rango de fechas.",
  parameters,
  execute,
};

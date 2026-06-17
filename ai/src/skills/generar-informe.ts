/**
 * src/skills/generar-informe.ts
 * Genera un informe agregado para el tenant y lo persiste en `informes`.
 * Tipos soportados: stock | gastos | productividad | eficiencia | ganancias.
 */
import { z } from "zod";
import { directus } from "../directus.js";
import { toSkillResult } from "./_helpers.js";
import type { Skill, SkillResult } from "./types.js";

const parametrosSchema = z
  .object({
    fecha_desde: z.string().datetime().optional(),
    fecha_hasta: z.string().datetime().optional(),
    ubicacion_id: z.union([z.string(), z.number()]).optional(),
    usuario_externo_id: z.union([z.string(), z.number()]).optional(),
    agrupar_por: z.enum(["ubicacion", "material", "usuario_externo", "dia", "semana", "mes"]).optional(),
  })
  .default({});

const parameters = z.object({
  tipo: z.enum(["stock", "gastos", "productividad", "eficiencia", "ganancias"]),
  parametros: parametrosSchema,
});

interface AggregateRow {
  clave: string;
  total: number;
  detalle: Record<string, unknown>;
}

async function aggregate(
  ctx: { tenant_id: string },
  tipo: string,
  params: z.infer<typeof parametrosSchema>
): Promise<{ rows: AggregateRow[]; metric: string }> {
  const dateFilter: Record<string, unknown> = {};
  if (params.fecha_desde) dateFilter._gte = params.fecha_desde;
  if (params.fecha_hasta) dateFilter._lte = params.fecha_hasta;

  switch (tipo) {
    case "stock": {
      const filter = {
        tenant_id: { _eq: ctx.tenant_id },
        ...(params.ubicacion_id ? { ubicacion_id: { _eq: params.ubicacion_id } } : {}),
      };
      const data = await directus.get<
        { id: string | number; material_id: string | number; ubicacion_id: string | number; cantidad: number }[]
      >("/items/stocks", {
        filter: encodeURIComponent(JSON.stringify(filter)),
        limit: "500",
        fields: "id,material_id,ubicacion_id,cantidad",
      });
      const list = Array.isArray(data) ? data : [];
      const rows: AggregateRow[] = list.map((r) => ({
        clave: `ubic:${r.ubicacion_id}/mat:${r.material_id}`,
        total: Number(r.cantidad ?? 0),
        detalle: r,
      }));
      return { rows, metric: "cantidad en stock" };
    }
    case "gastos": {
      const filter = {
        tenant_id: { _eq: ctx.tenant_id },
        ...(params.ubicacion_id ? { ubicacion_id: { _eq: params.ubicacion_id } } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {}),
      };
      const data = await directus.get<
        { id: string | number; cantidad: number; material_id: string | number; costo_unitario: number }[]
      >("/items/movimientos_stock", {
        filter: encodeURIComponent(JSON.stringify(filter)),
        limit: "1000",
        fields: "id,cantidad,material_id,costo_unitario",
      });
      const list = Array.isArray(data) ? data : [];
      const byMaterial = new Map<string, number>();
      for (const m of list) {
        const gasto = Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0);
        byMaterial.set(String(m.material_id), (byMaterial.get(String(m.material_id)) ?? 0) + gasto);
      }
      const rows: AggregateRow[] = [...byMaterial.entries()].map(([k, v]) => ({
        clave: `material:${k}`,
        total: v,
        detalle: { material_id: k },
      }));
      return { rows, metric: "gasto total (€)" };
    }
    case "productividad": {
      const filter = {
        tenant_id: { _eq: ctx.tenant_id },
        ...(params.usuario_externo_id ? { usuario_externo_id: { _eq: params.usuario_externo_id } } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {}),
      };
      const data = await directus.get<
        { id: string | number; usuario_interno_id: string | number | null; estado: string }[]
      >("/items/tareas", {
        filter: encodeURIComponent(JSON.stringify(filter)),
        limit: "1000",
        fields: "id,usuario_interno_id,estado",
      });
      const list = Array.isArray(data) ? data : [];
      const byUser = new Map<string, { completadas: number; total: number }>();
      for (const t of list) {
        const k = String(t.usuario_interno_id ?? "sin-asignar");
        const prev = byUser.get(k) ?? { completadas: 0, total: 0 };
        prev.total += 1;
        if (t.estado === "completada") prev.completadas += 1;
        byUser.set(k, prev);
      }
      const rows: AggregateRow[] = [...byUser.entries()].map(([k, v]) => ({
        clave: `usuario:${k}`,
        total: v.completadas,
        detalle: { ...v, ratio: v.total > 0 ? v.completadas / v.total : 0 },
      }));
      return { rows, metric: "tareas completadas" };
    }
    case "eficiencia": {
      // Ratio tareas completadas / total por ubicación
      const filter = {
        tenant_id: { _eq: ctx.tenant_id },
        ...(params.ubicacion_id ? { ubicacion_id: { _eq: params.ubicacion_id } } : {}),
      };
      const data = await directus.get<
        { id: string | number; ubicacion_id: string | number; estado: string }[]
      >("/items/tareas", {
        filter: encodeURIComponent(JSON.stringify(filter)),
        limit: "1000",
        fields: "id,ubicacion_id,estado",
      });
      const list = Array.isArray(data) ? data : [];
      const byUbic = new Map<string, { completadas: number; total: number }>();
      for (const t of list) {
        const k = String(t.ubicacion_id);
        const prev = byUbic.get(k) ?? { completadas: 0, total: 0 };
        prev.total += 1;
        if (t.estado === "completada") prev.completadas += 1;
        byUbic.set(k, prev);
      }
      const rows: AggregateRow[] = [...byUbic.entries()].map(([k, v]) => ({
        clave: `ubicacion:${k}`,
        total: v.total > 0 ? Number((v.completadas / v.total).toFixed(3)) : 0,
        detalle: { ...v, ratio: v.total > 0 ? v.completadas / v.total : 0 },
      }));
      return { rows, metric: "ratio eficiencia (completadas/total)" };
    }
    case "ganancias": {
      // Aproximación: ingresos (tareas completadas con valor) - gastos
      const [tareas, movs] = await Promise.all([
        directus.get<{ id: string | number; ubicacion_id: string | number; estado: string; valor?: number }[]>(
          "/items/tareas",
          {
            filter: encodeURIComponent(
              JSON.stringify({
                tenant_id: { _eq: ctx.tenant_id },
                estado: { _eq: "completada" },
                ...(params.ubicacion_id ? { ubicacion_id: { _eq: params.ubicacion_id } } : {}),
                ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {}),
              })
            ),
            limit: "1000",
            fields: "id,ubicacion_id,valor",
          }
        ),
        directus.get<{ cantidad: number; costo_unitario: number }[]>(
          "/items/movimientos_stock",
          {
            filter: encodeURIComponent(
              JSON.stringify({
                tenant_id: { _eq: ctx.tenant_id },
                ...(params.ubicacion_id ? { ubicacion_id: { _eq: params.ubicacion_id } } : {}),
                ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {}),
              })
            ),
            limit: "1000",
            fields: "cantidad,costo_unitario",
          }
        ),
      ]);
      const tareasList = Array.isArray(tareas) ? tareas : [];
      const movsList = Array.isArray(movs) ? movs : [];

      const byUbic = new Map<string, number>();
      for (const t of tareasList) {
        const k = String(t.ubicacion_id);
        byUbic.set(k, (byUbic.get(k) ?? 0) + Number(t.valor ?? 0));
      }
      const gastos = movsList.reduce(
        (acc, m) => acc + Number(m.cantidad ?? 0) * Number(m.costo_unitario ?? 0),
        0
      );
      const rows: AggregateRow[] = [...byUbic.entries()].map(([k, v]) => ({
        clave: `ubicacion:${k}`,
        total: Number((v - gastos / Math.max(byUbic.size, 1)).toFixed(2)),
        detalle: { ingresos: v, gastos_parte: gastos / Math.max(byUbic.size, 1) },
      }));
      return { rows, metric: "ganancia estimada (€)" };
    }
    default:
      return { rows: [], metric: "—" };
  }
}

async function execute(
  ctx: { tenant_id: string },
  params: z.infer<typeof parameters>
): Promise<SkillResult> {
  try {
    const { rows, metric } = await aggregate(ctx, params.tipo, params.parametros);
    const informe = await directus.post<{ id: string | number }>(
      "/items/informes",
      {
        tenant_id: ctx.tenant_id,
        tipo: params.tipo,
        parametros: params.parametros,
        metric,
        datos: rows,
        generado_en: new Date().toISOString(),
      }
    );
    const summary =
      `Informe de ${params.tipo} generado (id ${informe.id}). ` +
      `${rows.length} agrupaciones. Métrica: ${metric}. ` +
      (rows.length > 0
        ? `Top: ${rows.slice(0, 3).map((r) => `${r.clave}=${r.total}`).join(", ")}.`
        : "Sin datos suficientes.");
    return {
      ok: true,
      data: { informe_id: informe.id, rows, metric },
      message: `Informe ${params.tipo} generado`,
      summary,
    };
  } catch (err) {
    return toSkillResult(err, "generar informe");
  }
}

export const generarInforme: Skill = {
  name: "generar_informe",
  description:
    "Genera un informe agregado del tenant (stock, gastos, productividad, eficiencia o ganancias) " +
    "y lo persiste en la tabla informes. Devuelve filas agregadas + métrica.",
  parameters,
  execute,
};

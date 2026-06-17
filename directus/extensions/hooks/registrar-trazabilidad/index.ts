/**
 * ENTERAR.ME — Hook: registrar-trazabilidad
 * ------------------------------------------------------------
 * Hook `items.create` y `items.update` (after) sobre las colecciones
 * `tareas` y `movimientos_stock` que inserta en `eventos_tarea` un
 * registro con:
 *   - tipo:      depende de la acción y la colección
 *   - payload:   diff del cambio (campos modificados)
 *   - timestamp: now()
 *   - ubicacion_id: el de la tarea / movimiento
 *   - usuario_interno_id: del contexto (Directus accountability)
 *
 * Así se garantiza trazabilidad total ubicación+momento.
 *
 * Tipos de evento generados:
 *   - Tarea creada                 → tipo='nota', payload.evento='tarea_creada'
 *   - Tarea actualizada (estado)   → tipo='nota', payload.evento='tarea_actualizada'
 *       + si estado pasa a en_progreso → tipo='inicio'
 *       + si estado pasa a completada  → tipo='fin'
 *       + si cambia ubicacion_id       → tipo='cambio_ubicacion'
 *   - Movimiento de stock creado   → tipo='material_usado'
 *       (asociado a la tarea si lleva tarea_id, else crea evento "huérfano"
 *        referenciando una tarea ficticia? No: eventos_tarea.tarea_id es NOT NULL,
 *        así que solo generamos evento si el movimiento lleva tarea_id.
 *        Si no lleva, el movimiento en sí ya es trazabilidad en movimientos_stock.)
 */

import { defineHook } from '@directus/extensions-sdk';
import type { Knex } from 'knex';

const COLECCIONES_TRAZADAS = new Set(['tareas', 'movimientos_stock']);

export default defineHook(({ action }, { database, accountability, logger }) => {
  const knex: Knex = database;

  // ---------- CREATE ----------
  action('items.create', async (meta, context) => {
    const collection = meta.collection;
    if (!COLECCIONES_TRAZADAS.has(collection)) return;

    try {
      const records = Array.isArray(meta.payloads)
        ? meta.payloads.map((p: any, i: number) => ({ id: Array.isArray(meta.keys) ? meta.keys[i] : meta.key, ...p }))
        : [{ id: meta.key, ...(meta.payload || {}) }];

      for (const rec of records) {
        await registrarEventoTrazabilidad(knex, 'create', collection, rec, null, context);
      }
    } catch (err: any) {
      logger.error(`[trazabilidad] create ${collection}: ${err.message || err}`);
      // No relanzamos: la operación principal ya se ha hecho, y la trazabilidad
      // es best-effort (la operación de negocio no debe fallar por el log).
    }
  });

  // ---------- UPDATE ----------
  action('items.update', async (meta, context) => {
    const collection = meta.collection;
    if (!COLECCIONES_TRAZADAS.has(collection)) return;

    try {
      const keys: any[] = Array.isArray(meta.keys) ? meta.keys : [meta.keys];
      const payloads: any[] = Array.isArray(meta.payloads) ? meta.payloads : [meta.payload];

      for (let i = 0; i < keys.length; i++) {
        const id = keys[i];
        const newPayload = payloads[i] || meta.payload;

        // Recoger el registro anterior para calcular diff
        // (no disponible directamente en el hook después, así que leemos de la BD)
        const current = await knex(collection).where({ id }).first();
        if (!current) continue;

        await registrarEventoTrazabilidad(knex, 'update', collection, current, newPayload, context);
      }
    } catch (err: any) {
      logger.error(`[trazabilidad] update ${collection}: ${err.message || err}`);
    }
  });
});

// ---------- Lógica de generación de eventos ----------

async function registrarEventoTrazabilidad(
  knex: Knex,
  accion: 'create' | 'update',
  collection: string,
  record: any,
  newPayload: any | null,
  context: any
) {
  const now = new Date().toISOString();
  const acc = context?.accountability || null;
  // usuario_interno_id del contexto (si está disponible vía directus_user_id)
  let usuarioInternoId: string | null = null;
  if (acc?.user) {
    const ui = await knex('usuarios_internos').where({ directus_user_id: acc.user }).first();
    if (ui) usuarioInternoId = ui.id;
  }

  if (collection === 'tareas') {
    const tareaId = record.id;
    const ubicacionId = record.ubicacion_id || newPayload?.ubicacion_id || null;

    if (accion === 'create') {
      await knex('eventos_tarea').insert({
        tarea_id: tareaId,
        tipo: 'nota',
        payload: {
          evento: 'tarea_creada',
          titulo: record.titulo,
          estado_inicial: record.estado,
          prioridad: record.prioridad,
          usuario_externo_id: record.usuario_externo_id,
          usuario_interno_id_asignado: record.usuario_interno_id,
        },
        timestamp: now,
        usuario_interno_id: usuarioInternoId,
        ubicacion_id: ubicacionId,
      });
      return;
    }

    // update: calcular diff
    const diff: Record<string, { from: any; to: any }> = {};
    if (newPayload && typeof newPayload === 'object') {
      for (const key of Object.keys(newPayload)) {
        // ignorar campos técnicos
        if (['fecha_actualizacion', 'updated_at'].includes(key)) continue;
        const oldVal = record[key];
        const newVal = newPayload[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          diff[key] = { from: oldVal, to: newVal };
        }
      }
    }

    const eventos: any[] = [];

    // Cambio de estado → tipo específico
    if (diff.estado) {
      const to = diff.estado.to;
      if (to === 'en_progreso') {
        eventos.push({
          tarea_id: tareaId,
          tipo: 'inicio',
          payload: { evento: 'tarea_iniciada', from: diff.estado.from, to },
          timestamp: now,
          usuario_interno_id: usuarioInternoId,
          ubicacion_id: ubicacionId,
        });
      } else if (to === 'completada') {
        eventos.push({
          tarea_id: tareaId,
          tipo: 'fin',
          payload: { evento: 'tarea_finalizada', from: diff.estado.from, to },
          timestamp: now,
          usuario_interno_id: usuarioInternoId,
          ubicacion_id: ubicacionId,
        });
      } else if (to === 'pendiente' && diff.estado.from === 'en_progreso') {
        eventos.push({
          tarea_id: tareaId,
          tipo: 'pausa',
          payload: { evento: 'tarea_pausada', from: diff.estado.from, to },
          timestamp: now,
          usuario_interno_id: usuarioInternoId,
          ubicacion_id: ubicacionId,
        });
      }
    }

    // Cambio de ubicación → tipo cambio_ubicacion
    if (diff.ubicacion_id) {
      eventos.push({
        tarea_id: tareaId,
        tipo: 'cambio_ubicacion',
        payload: {
          evento: 'cambio_ubicacion',
          from: diff.ubicacion_id.from,
          to: diff.ubicacion_id.to,
        },
        timestamp: now,
        usuario_interno_id: usuarioInternoId,
        ubicacion_id: diff.ubicacion_id.to || ubicacionId,
      });
    }

    // Cambio en materiales (M2M) → tipo material_usado
    if (diff.material_ids) {
      eventos.push({
        tarea_id: tareaId,
        tipo: 'material_usado',
        payload: { evento: 'materiales_actualizados', diff: diff.material_ids },
        timestamp: now,
        usuario_interno_id: usuarioInternoId,
        ubicacion_id: ubicacionId,
      });
    }

    // Cualquier otro cambio → tipo 'nota' con diff
    const otherKeys = Object.keys(diff).filter(
      (k) => !['estado', 'ubicacion_id', 'material_ids'].includes(k)
    );
    if (otherKeys.length > 0) {
      eventos.push({
        tarea_id: tareaId,
        tipo: 'nota',
        payload: {
          evento: 'tarea_actualizada',
          diff: otherKeys.reduce((acc: any, k) => { acc[k] = diff[k]; return acc; }, {}),
        },
        timestamp: now,
        usuario_interno_id: usuarioInternoId,
        ubicacion_id: ubicacionId,
      });
    }

    if (eventos.length > 0) {
      await knex('eventos_tarea').insert(eventos);
    }
    return;
  }

  if (collection === 'movimientos_stock') {
    // Solo generamos evento si el movimiento lleva tarea_id (eventos_tarea.tarea_id NOT NULL)
    if (!record.tarea_id) return;

    const ubicacionId = record.ubicacion_id || null;
    const tipoMovimiento = record.tipo; // entrada | salida | ajuste

    await knex('eventos_tarea').insert({
      tarea_id: record.tarea_id,
      tipo: 'material_usado',
      payload: {
        evento: 'movimiento_stock',
        tipo_movimiento: tipoMovimiento,
        cantidad: record.cantidad,
        material_id: record.material_id,
        stock_id: record.stock_id,
        motivo: record.motivo || null,
      },
      timestamp: now,
      usuario_interno_id: usuarioInternoId,
      ubicacion_id: ubicacionId,
    });
    return;
  }
}

/**
 * ENTERAR.ME — Hook: validar-orden-creacion
 * ------------------------------------------------------------
 * Hook `items.create` (before) que valida el ORDEN OBLIGATORIO de creación:
 *
 *   1. usuarios_externos  → ubicacion_id debe existir y pertenecer al mismo tenant
 *   2. usuarios_internos  → directus_user_id y ubicacion_principal_id deben
 *                           existir y pertenecer al mismo tenant
 *   3. materiales         → usuario_externo_id debe existir en el mismo tenant
 *   4. tareas             → ubicacion_id, usuario_externo_id en mismo tenant;
 *                           si vienen material_ids, todos deben existir
 *
 * Lanza InvalidPayloadError con mensaje claro si no se cumple.
 *
 * El orden correcto de creación en el tenant es:
 *   Ubicación → Usuario externo → Usuario interno → Material → Tarea
 */

import { defineHook } from '@directus/extensions-sdk';
import type { Knex } from 'knex';
import { InvalidPayloadError } from '@directus/errors';

const COLECCIONES_VALIDADAS = new Set([
  'usuarios_externos',
  'usuarios_internos',
  'materiales',
  'tareas',
]);

export default defineHook(({ action }, { database, logger }) => {
  const knex: Knex = database;

  action('items.create', async (meta, context) => {
    const collection = meta.collection;
    if (!COLECCIONES_VALIDADAS.has(collection)) return;

    // El payload puede venir en meta.payload (Single) o en meta.payloads (Multi)
    const payloads: any[] = Array.isArray(meta.payloads)
      ? meta.payloads
      : [meta.payload];

    for (const payload of payloads) {
      if (!payload || typeof payload !== 'object') continue;

      try {
        switch (collection) {
          case 'usuarios_externos':
            await validarUsuarioExterno(knex, payload);
            break;
          case 'usuarios_internos':
            await validarUsuarioInterno(knex, payload);
            break;
          case 'materiales':
            await validarMaterial(knex, payload);
            break;
          case 'tareas':
            await validarTarea(knex, payload);
            break;
        }
      } catch (err: any) {
        logger.warn(`[validar-orden-creacion] ${collection}: ${err.message}`);
        throw err;
      }
    }
  });
});

// ---------- Helpers ----------

async function validarUsuarioExterno(knex: Knex, p: any) {
  const tenantId = p.tenant_id;
  if (!tenantId) throw new InvalidPayloadError({ reason: 'usuarios_externos: tenant_id es obligatorio' });

  // Si no hay ubicacion_id, OK (es nullable)
  if (!p.ubicacion_id) return;

  const ubicacion = await knex('ubicaciones')
    .where({ id: p.ubicacion_id, tenant_id: tenantId })
    .first();

  if (!ubicacion) {
    throw new InvalidPayloadError({
      reason: `usuarios_externos: la ubicacion_id "${p.ubicacion_id}" no existe o no pertenece al tenant "${tenantId}". Cree primero la ubicación (orden obligatorio: Ubicación → Usuario externo).`,
    });
  }
}

async function validarUsuarioInterno(knex: Knex, p: any) {
  const tenantId = p.tenant_id;
  if (!tenantId) throw new InvalidPayloadError({ reason: 'usuarios_internos: tenant_id es obligatorio' });

  if (!p.directus_user_id) {
    throw new InvalidPayloadError({
      reason: 'usuarios_internos: directus_user_id es obligatorio. Cree primero el usuario en directus_users con el tenant_id correcto.',
    });
  }

  // El directus_user debe tener el mismo tenant_id
  const directusUser = await knex('directus_users')
    .where({ id: p.directus_user_id })
    .first();

  if (!directusUser) {
    throw new InvalidPayloadError({
      reason: `usuarios_internos: el directus_user_id "${p.directus_user_id}" no existe.`,
    });
  }
  if (directusUser.tenant_id && directusUser.tenant_id !== tenantId) {
    throw new InvalidPayloadError({
      reason: `usuarios_internos: el directus_user_id pertenece a otro tenant (${directusUser.tenant_id}) != ${tenantId}.`,
    });
  }

  // ubicacion_principal_id (nullable pero si viene, debe ser del tenant)
  if (p.ubicacion_principal_id) {
    const ubicacion = await knex('ubicaciones')
      .where({ id: p.ubicacion_principal_id, tenant_id: tenantId })
      .first();
    if (!ubicacion) {
      throw new InvalidPayloadError({
        reason: `usuarios_internos: la ubicacion_principal_id no existe o no pertenece al tenant. Cree primero la ubicación.`,
      });
    }
  }
}

async function validarMaterial(knex: Knex, p: any) {
  const tenantId = p.tenant_id;
  if (!tenantId) throw new InvalidPayloadError({ reason: 'materiales: tenant_id es obligatorio' });

  // usuario_externo_id debe existir en el mismo tenant
  if (p.usuario_externo_id) {
    const usuarioExterno = await knex('usuarios_externos')
      .where({ id: p.usuario_externo_id, tenant_id: tenantId })
      .first();
    if (!usuarioExterno) {
      throw new InvalidPayloadError({
        reason: `materiales: el usuario_externo_id "${p.usuario_externo_id}" no existe o no pertenece al tenant. Cree primero el usuario externo (orden obligatorio: Usuario externo → Material).`,
      });
    }
  }

  // organization_id (si viene) debe ser el propio tenant
  if (p.organization_id && p.organization_id !== tenantId) {
    throw new InvalidPayloadError({
      reason: `materiales: organization_id debe ser el propio tenant (${tenantId}), se recibió ${p.organization_id}.`,
    });
  }
}

async function validarTarea(knex: Knex, p: any) {
  const tenantId = p.tenant_id;
  if (!tenantId) throw new InvalidPayloadError({ reason: 'tareas: tenant_id es obligatorio' });

  // ubicacion_id obligatorio y del tenant
  if (!p.ubicacion_id) {
    throw new InvalidPayloadError({ reason: 'tareas: ubicacion_id es obligatorio (orden: Ubicación → Tarea).' });
  }
  const ubicacion = await knex('ubicaciones')
    .where({ id: p.ubicacion_id, tenant_id: tenantId })
    .first();
  if (!ubicacion) {
    throw new InvalidPayloadError({
      reason: `tareas: la ubicacion_id no existe o no pertenece al tenant.`,
    });
  }

  // usuario_externo_id obligatorio y del tenant
  if (!p.usuario_externo_id) {
    throw new InvalidPayloadError({ reason: 'tareas: usuario_externo_id es obligatorio (orden: Usuario externo → Tarea).' });
  }
  const usuarioExterno = await knex('usuarios_externos')
    .where({ id: p.usuario_externo_id, tenant_id: tenantId })
    .first();
  if (!usuarioExterno) {
    throw new InvalidPayloadError({
      reason: `tareas: el usuario_externo_id no existe o no pertenece al tenant.`,
    });
  }

  // usuario_interno_id (si viene) del tenant
  if (p.usuario_interno_id) {
    const usuarioInterno = await knex('usuarios_internos')
      .where({ id: p.usuario_interno_id, tenant_id: tenantId })
      .first();
    if (!usuarioInterno) {
      throw new InvalidPayloadError({
        reason: `tareas: el usuario_interno_id no existe o no pertenece al tenant.`,
      });
    }
  }

  // material_ids (M2M) — todos deben existir en el tenant
  if (Array.isArray(p.material_ids) && p.material_ids.length > 0) {
    for (const mid of p.material_ids) {
      // Puede ser {id} o UUID string
      const materialId = typeof mid === 'string' ? mid : mid?.id;
      if (!materialId) continue;
      const material = await knex('materiales')
        .where({ id: materialId, tenant_id: tenantId })
        .first();
      if (!material) {
        throw new InvalidPayloadError({
          reason: `tareas: el material_id "${materialId}" no existe o no pertenece al tenant.`,
        });
      }
    }
  }
}

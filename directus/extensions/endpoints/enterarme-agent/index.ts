/**
 * ENTERAR.ME — Endpoint del Agente IA
 * ------------------------------------------------------------
 * POST /agent/chat
 *
 * Body:
 *   {
 *     "tenant_id":        UUID,
 *     "conversacion_id"?: UUID,   // si no viene, se crea una nueva
 *     "mensaje":          string
 *   }
 *
 * Flujo:
 *   1. Persiste el mensaje del usuario en agente_mensajes (rol=user)
 *   2. Llama al servicio IA (http://ai:3030/chat) con tenant_id y mensaje
 *   3. Persiste la respuesta del asistente en agente_mensajes (rol=assistant)
 *      incluyendo tool_calls y skill_invocada si las hubo
 *   4. Devuelve { conversacion_id, respuesta, skill_invocada }
 *
 * Protegido por token de servicio (Authorization: Bearer <DIRECTUS_SERVICE_TOKEN>).
 */

import { defineEndpoint } from '@directus/extensions-sdk';
import type { Knex } from 'knex';

interface AgentChatInput {
  tenant_id?: string;
  conversacion_id?: string;
  mensaje?: string;
}

interface IAChatResponse {
  respuesta?: string;
  content?: string;
  skill_invocada?: string;
  tool_calls?: any;
  metadata?: any;
}

export default defineEndpoint((router, { database, env, logger }) => {
  const knex: Knex = database;

  router.post('/chat', async (req, res) => {
    // ----- 0. Auth: service token -----
    const serviceToken = env.DIRECTUS_SERVICE_TOKEN;
    const authHeader = req.headers['authorization'] || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!serviceToken || bearer !== serviceToken) {
      return res.status(401).json({ error: 'unauthorized', message: 'Service token inválido o ausente' });
    }

    // ----- 1. Validar input -----
    const input = (req.body || {}) as AgentChatInput;
    const { tenant_id, conversacion_id, mensaje } = input;

    if (!tenant_id) {
      return res.status(400).json({ error: 'invalid_payload', message: 'tenant_id es obligatorio' });
    }
    if (!mensaje || typeof mensaje !== 'string' || mensaje.trim().length === 0) {
      return res.status(400).json({ error: 'invalid_payload', message: 'mensaje es obligatorio' });
    }

    // Verificar que el tenant existe
    const tenant = await knex('tenants').where({ id: tenant_id }).first();
    if (!tenant) {
      return res.status(404).json({ error: 'tenant_not_found', message: `Tenant ${tenant_id} no existe` });
    }

    try {
      let convId = conversacion_id;

      // ----- 2. Crear conversación si no viene -----
      if (!convId) {
        const [conv] = await knex('agente_conversaciones')
          .insert({
            tenant_id,
            titulo: mensaje.slice(0, 100),
          })
          .returning('*');
        convId = conv.id;
      } else {
        // Verificar que la conversación pertenece al tenant
        const conv = await knex('agente_conversaciones').where({ id: convId, tenant_id }).first();
        if (!conv) {
          return res.status(404).json({ error: 'conversacion_not_found', message: 'La conversación no existe o no pertenece al tenant' });
        }
        // updated_at
        await knex('agente_conversaciones').where({ id: convId }).update({ updated_at: new Date() });
      }

      // ----- 3. Persistir mensaje del usuario -----
      await knex('agente_mensajes').insert({
        conversacion_id: convId,
        rol: 'user',
        contenido: mensaje,
        timestamp: new Date(),
      });

      // ----- 4. Llamar al servicio IA -----
      const aiUrl = env.AI_SERVICE_URL || 'http://ai:3030';
      const aiResponse = await fetch(`${aiUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id,
          conversacion_id: convId,
          mensaje,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text().catch(() => '');
        logger.error(`[agent] IA devolvió ${aiResponse.status}: ${errText}`);
        // Persistimos un mensaje de error del asistente
        await knex('agente_mensajes').insert({
          conversacion_id: convId,
          rol: 'assistant',
          contenido: '[Error: el servicio de IA no está disponible]',
          metadata: { error: errText, status: aiResponse.status },
          timestamp: new Date(),
        });
        return res.status(502).json({
          error: 'ai_service_error',
          message: 'El servicio de IA devolvió un error',
          conversacion_id: convId,
        });
      }

      const aiData = (await aiResponse.json()) as IAChatResponse;
      const respuesta = aiData.respuesta || aiData.content || '';
      const skillInvocada = aiData.skill_invocada || null;
      const toolCalls = aiData.tool_calls || null;

      // ----- 5. Persistir respuesta del asistente -----
      await knex('agente_mensajes').insert({
        conversacion_id: convId,
        rol: 'assistant',
        contenido: respuesta,
        tool_calls: toolCalls,
        skill_invocada: skillInvocada,
        timestamp: new Date(),
      });

      // ----- 6. Devolver -----
      return res.json({
        conversacion_id: convId,
        respuesta,
        skill_invocada: skillInvocada,
        tool_calls: toolCalls,
        metadata: aiData.metadata || null,
      });
    } catch (err: any) {
      logger.error(`[agent] Error: ${err.message || err}`);
      return res.status(500).json({
        error: 'agent_chat_failed',
        message: err.message || 'Error desconocido en agent chat',
      });
    }
  });

  // Endpoint de salud
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'enterarme-agent' });
  });

  // Endpoint para listar conversaciones de un tenant (con mensajes)
  router.get('/conversaciones/:tenant_id', async (req, res) => {
    const serviceToken = env.DIRECTUS_SERVICE_TOKEN;
    const authHeader = req.headers['authorization'] || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!serviceToken || bearer !== serviceToken) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { tenant_id } = req.params;
    const conversaciones = await knex('agente_conversaciones')
      .where({ tenant_id })
      .orderBy('updated_at', 'desc')
      .limit(50);

    res.json({ conversaciones });
  });
});

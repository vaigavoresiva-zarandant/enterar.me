/**
 * src/auth.ts
 * Helpers de autenticación JWT para Fastify.
 * El token es emitido por Directus con el mismo SECRET (ver JWT_SECRET).
 * El payload debe incluir: { id, tenant_id, role, ... }
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import { config } from "./config.js";

export interface JwtPayload {
  id: string;
  tenant_id: string;
  role: string;
  // Directus puede enviar otros campos; los permitimos:
  [key: string]: unknown;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Verifica el JWT y carga req.user. Si el token no es válido, devuelve 401.
     * Salvo en rutas /health y /login, todas lo usan vía hook onRequest.
     */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    // fast-jwt (subyacente) usa `iss` en SignerOptions y `allowedIss` en
    // VerifierOptions. Validamos el issuer del token que emite Directus.
    sign: { iss: config.JWT_ISSUER },
    verify: { allowedIss: config.JWT_ISSUER },
  });

  app.decorate(
    "authenticate",
    async function authenticate(req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
        if (!req.user?.tenant_id) {
          if (!reply.sent) reply.code(401).send({ error: "Token sin tenant_id" });
          return;
        }
      } catch {
        if (!reply.sent) reply.code(401).send({ error: "Token inválido o expirado" });
      }
    }
  );
});

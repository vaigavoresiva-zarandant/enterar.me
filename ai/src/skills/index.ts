/**
 * src/skills/index.ts
 * Registro central de skills del agente ENTERAR.ME.
 * Para añadir una nueva skill: créala en `src/skills/<nombre>.ts` exportando
 * un objeto Skill, e impórtala aquí en el array `registry`.
 */
import type { Skill } from "./types.js";
import { crearUbicacion } from "./crear-ubicacion.js";
import { crearUsuarioExterno } from "./crear-usuario-externo.js";
import { crearUsuarioInterno } from "./crear-usuario-interno.js";
import { crearMaterial } from "./crear-material.js";
import { crearTarea } from "./crear-tarea.js";
import { registrarStock } from "./registrar-stock.js";
import { consultarTrazabilidad } from "./consultar-trazabilidad.js";
import { generarInforme } from "./generar-informe.js";

export type { Skill, SkillContext, SkillResult } from "./types.js";

export const registry: Skill[] = [
  crearUbicacion,
  crearUsuarioExterno,
  crearUsuarioInterno,
  crearMaterial,
  crearTarea,
  registrarStock,
  consultarTrazabilidad,
  generarInforme,
];

/** Mapa nombre → skill para acceso O(1) desde el orchestrator */
export const skillsByName: Map<string, Skill> = new Map(
  registry.map((s) => [s.name, s])
);

/** Devuelve una skill por nombre, o undefined */
export function getSkill(name: string): Skill | undefined {
  return skillsByName.get(name);
}

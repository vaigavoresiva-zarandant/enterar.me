/**
 * src/skills/types.ts
 * Contrato común para todas las skills.
 *
 * `Skill` es NO genérico a propósito: el registro aloja skills heterogéneas
 * (cada una con su propio ZodObject) y queremos poder meterlas todas en un
 * mismo array. La validación concreta de params la hace `parameters.safeParse`
 * en el orchestrator ANTES de llamar a `execute`, por lo que el tipo del
 * parámetro de execute se especializa dentro de cada skill con `z.infer`.
 *
 * Usamos sintaxis de método (`execute(...)` en vez de `execute: (...)`) para
 * que TypeScript haga el check bivariante y permita la asignación.
 */
import { z } from "zod";

export interface SkillContext {
  tenant_id: string;
  conversacion_id?: string;
  usuario_id?: string;
}

export interface SkillResult {
  ok: boolean;
  data?: unknown;
  message: string;
  /** Resumen textual que se envía de vuelta al LLM */
  summary?: string;
}

export interface Skill {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  execute(ctx: SkillContext, params: Record<string, unknown>): Promise<SkillResult>;
}

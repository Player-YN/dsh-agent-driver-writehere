/**
 * Host-plane WriteHere driver: register + bind article-editor → writehere.
 * @module @deepseek-ai/dsh-writehere
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-drivers'
import { WRITEHERE_DRIVER_ID } from './ids.ts'
import { WriteHereAgent } from './agent.ts'
import type {} from './types.ts'

// Re-export the session-event augmentations: a bare `import type {}` is elided
// from the declaration output, so consumers of the built package would lose
// `agent/driver` / `article/get-info` / `article/update` typing without this.
export type * from './types.ts'

export { WriteHereAgent } from './agent.ts'
export { WRITEHERE_DRIVER_ID } from './ids.ts'
export { methodologySkillContext, METHODOLOGY_MARKERS } from './skills.ts'
export {
  DECIDE_RESPONSE_FORMAT,
  UPDATE_RESPONSE_FORMAT,
  UPDATE_JSON_SCHEMA,
  DECIDE_JSON_SCHEMA,
  structuredResponseFormat,
  parseNodeUpdate,
  parseNodeDecision,
} from './parse.ts'
export { MEMORY_INDEX_OPEN, MEMORY_OPEN, memoryIndexText, memoryHitsText } from './memory.ts'
export {
  DECIDE_INSTRUCTION,
  DECIDE_WRITE_INSTRUCTION,
  DECIDE_ATOM_INSTRUCTION,
  UPDATE_INSTRUCTION,
  RETRIEVAL_PERSONA,
  RETRIEVAL_PROMPT_PREFIX,
  isRetrievalGoal,
  EXECUTE_THINK_INSTRUCTION,
  EXECUTE_WRITE_INSTRUCTION,
  GET_INFO_CLOSE,
  GET_INFO_OPEN,
  LAB_UNAVAILABLE_TEXT,
} from './prompts.ts'

/** Cordis plugin name. */
export const name = 'writehere'

/** Host-plane `ctx.agentDrivers` — construct happens before preset mount. */
export const inject = ['agentDrivers']

/**
 * Register WriteHereAgent and bind the article-editor preset.
 * Must use the injected `ctx.agentDrivers` so the effects belong to this fiber.
 * @param ctx - host context that already provides agentDrivers
 */
export function apply(ctx: Context): void {
  ctx.agentDrivers.register(WRITEHERE_DRIVER_ID, WriteHereAgent)
  ctx.agentDrivers.bindPreset('article-editor', WRITEHERE_DRIVER_ID)
  ctx.agentDrivers.bindPreset('xieka', WRITEHERE_DRIVER_ID)
}

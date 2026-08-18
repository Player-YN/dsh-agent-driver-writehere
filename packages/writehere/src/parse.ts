/**
 * Strict JSON parsers for WriteHere IsAtomic / TypedPlan replies.
 * @module @deepseek-ai/dsh-writehere/parse
 */

import type { ResponseFormat } from '@deepseek-ai/dsh-llm'

/** Update(v*, K) JSON Schema. Used when the adapter honors json_schema. */
export const UPDATE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: { goal: { type: 'string', minLength: 1 } },
  required: ['goal'],
}

/** IsAtomic / TypedPlan JSON Schema. Used when the adapter honors json_schema. */
export const DECIDE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    atomic: { type: 'boolean' },
    children: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['task', 'think', 'write'] },
          goal: { type: 'string', minLength: 1 },
          atomic: { type: 'boolean' },
          dependsOn: { type: 'array', items: { type: 'string' } },
          length: { type: 'integer', exclusiveMinimum: 0 },
        },
        required: ['type', 'goal'],
      },
    },
  },
}

/**
 * Constrained decode for Update/decide.
 * Default `json_object` (DeepSeek chat-completions). Set `DSH_JSON_SCHEMA=1`
 * when the adapter honors `json_schema`.
 */
export function structuredResponseFormat(kind: 'update' | 'decide'): ResponseFormat {
  if (process.env.DSH_JSON_SCHEMA !== '1') return { type: 'json_object' }
  return {
    type: 'json_schema',
    json_schema: {
      name: kind === 'update' ? 'writehere_update' : 'writehere_decide',
      strict: true,
      schema: kind === 'update' ? UPDATE_JSON_SCHEMA : DECIDE_JSON_SCHEMA,
    },
  }
}

/** Decide ticks request official JSON Output. Prose ticks omit this. */
export const DECIDE_RESPONSE_FORMAT: ResponseFormat = structuredResponseFormat('decide')

/** Update ticks request the same JSON Output family as decide. */
export const UPDATE_RESPONSE_FORMAT: ResponseFormat = structuredResponseFormat('update')

/** One TypedPlan child accepted by `decomposeNode`. */
export interface PlanChild {
  id?: string
  type: 'task' | 'think' | 'write'
  goal: string
  atomic?: boolean
  dependsOn?: string[]
  length?: number
}

/** Paper Update(v*, K): refine this node's goal only. */
export interface NodeUpdate {
  goal: string
}

type NodeType = PlanChild['type']

const NODE_TYPES = new Set<string>(['task', 'search', 'think', 'write'])

/** Model decision for a non-atomic ready node. */
export type NodeDecision =
  | { kind: 'atomic' }
  | { kind: 'plan'; children: PlanChild[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Extract one JSON object from assistant text. Fenced ```json blocks are
 * accepted; anything outside the first `{` … last `}` is ignored.
 * @param text - raw assistant text
 * @returns the parsed value
 */
export function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = (fenced?.[1] ?? text).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('expected a JSON object')
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown
  } catch {
    throw new Error('expected a JSON object')
  }
}

function parseChildren(value: unknown): PlanChild[] {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error('plan children must be a non-empty array')
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`child ${index} must be an object`)
    const keys = Object.keys(entry)
    for (const key of keys) {
      if (key !== 'type' && key !== 'goal' && key !== 'atomic' && key !== 'dependsOn' && key !== 'id' && key !== 'length') {
        throw new Error(`child ${index} has unknown key ${key}`)
      }
    }
    if (typeof entry.type !== 'string' || !NODE_TYPES.has(entry.type as NodeType)) {
      throw new Error(`child ${index} type must be task (or its alias search), think, or write`)
    }
    if (typeof entry.goal !== 'string' || entry.goal.trim() === '') {
      throw new Error(`child ${index} goal must be a non-empty string`)
    }
    if (entry.atomic !== undefined && typeof entry.atomic !== 'boolean') {
      throw new Error(`child ${index} atomic must be a boolean`)
    }
    if (entry.dependsOn !== undefined) {
      const raw = Array.isArray(entry.dependsOn) ? entry.dependsOn : [entry.dependsOn]
      const ids: string[] = []
      for (const id of raw) {
        if (typeof id === 'string' && id.trim()) ids.push(id.trim())
        else if (typeof id === 'number' && Number.isInteger(id)) ids.push(String(id))
        else throw new Error(`child ${index} dependsOn must be a string array`)
      }
      if (ids.length === 0) throw new Error(`child ${index} dependsOn must be a string array`)
      entry.dependsOn = ids
    }
    if (entry.id !== undefined && (typeof entry.id !== 'string' || entry.id.trim() === '')) {
      throw new Error(`child ${index} id must be a non-empty string`)
    }
    if (entry.length !== undefined && (typeof entry.length !== 'number' || !Number.isInteger(entry.length) || entry.length <= 0)) {
      throw new Error(`child ${index} length must be a positive integer`)
    }
    const child: PlanChild = {
      type: entry.type === 'search' ? 'task' : entry.type as NodeType,
      goal: entry.goal,
      ...entry.atomic === undefined ? {} : { atomic: entry.atomic },
      ...entry.dependsOn === undefined ? {} : { dependsOn: entry.dependsOn as string[] },
      ...entry.id === undefined ? {} : { id: entry.id },
      ...entry.length === undefined ? {} : { length: entry.length },
    }
    return child
  })
}

/**
 * Parse Update(v*, K). Legal keys: goal only.
 */
export function parseNodeUpdate(text: string): NodeUpdate {
  const value = parseJsonObject(text)
  if (!isRecord(value)) throw new Error('update must be a JSON object')
  for (const key of Object.keys(value)) {
    if (key !== 'goal') throw new Error(`update has unknown key ${key}`)
  }
  if (typeof value.goal !== 'string' || value.goal.trim() === '') {
    throw new Error('update goal must be a non-empty string')
  }
  return { goal: value.goal.trim() }
}

/**
 * Parse an IsAtomic-or-TypedPlan assistant reply.
 * @param text - raw assistant text
 * @returns atomic execution or a child plan
 */
export function parseNodeDecision(text: string): NodeDecision {
  const value = parseJsonObject(text)
  if (!isRecord(value)) throw new Error('decision must be a JSON object')
  for (const key of Object.keys(value)) {
    if (key !== 'atomic' && key !== 'children') {
      throw new Error(`decision has unknown key ${key}`)
    }
  }
  if (value.atomic === true) {
    if (value.children !== undefined) throw new Error('atomic decision cannot include children')
    return { kind: 'atomic' }
  }
  if (value.atomic !== undefined && value.atomic !== false) {
    throw new Error('atomic must be a boolean')
  }
  return { kind: 'plan', children: parseChildren(value.children) }
}

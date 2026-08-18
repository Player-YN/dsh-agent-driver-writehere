/**
 * Algorithm 1: one WriteHere scheduler over a claimed turn.
 * @module @deepseek-ai/dsh-writehere/scheduler
 */

import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent'
import {
  allChildrenDone,
  commitNode,
  decomposeNode,
  isAtomicFlag,
  isLabType,
  markRunning,
  pickReadyNode,
  setGoal,
  type ArticleNode,
  type ArticleTree,
} from '@deepseek-ai/dsh-article-tree/src/engine.ts'
import { getExecuteInfo, getPlannerInfo, type ArticleNodeInfo } from '@deepseek-ai/dsh-article-tree/src/getinfo.ts'
import { loadLabChildId, saveLabChild } from '@deepseek-ai/dsh-article-tree/src/session.ts'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ResponseFormat } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import type { Context } from '@deepseek-ai/cordis'
import {
  DECIDE_RESPONSE_FORMAT,
  UPDATE_RESPONSE_FORMAT,
  parseNodeDecision,
  parseNodeUpdate,
} from './parse.ts'
import { memoryHitsText, memoryIndexText, MEMORY_INDEX_OPEN } from './memory.ts'
import {
  COMPOSE_WRITE_INSTRUCTION,
  DECIDE_ATOM_INSTRUCTION,
  DECIDE_RETRY_INSTRUCTION,
  DECIDE_WRITE_INSTRUCTION,
  EXECUTE_THINK_INSTRUCTION,
  GET_INFO_CLOSE,
  GET_INFO_OPEN,
  isRetrievalGoal,
  LAB_PERSONA,
  LAB_UNAVAILABLE_TEXT,
  RETRIEVAL_PERSONA,
  RETRIEVAL_PROMPT_PREFIX,
  UPDATE_INSTRUCTION,
  writeLengthInstruction,
} from './prompts.ts'
import { appendWriteSection, ensureTree, loadTree, markAtomic, readDraft, saveTree, startTree } from './tree.ts'
import { methodologySkillContext } from './skills.ts'
import { WRITEHERE_DRIVER_ID } from './ids.ts'
import type {} from './types.ts'

const MAX_TICKS = 3000
const DRIVER_PLUGIN = 'writehere'

/** Host services the scheduler needs from WriteHereAgent. */
export interface SchedulerHost {
  readonly session: Session
  readonly ctx: Context
  readonly self: Agent
  readonly options: AgentOptions
  readonly turn: number
  readonly step: number
  readonly signal: AbortSignal
  completeText(options?: { responseFormat?: ResponseFormat }): Promise<string>
}

type TickEnd = 'continue' | 'park'

function latestUserText(session: Session): string {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i]
    if (event?.type !== 'user/message') continue
    if (event.data.source.kind !== 'user') continue
    const parts: string[] = []
    for (const block of event.data.content) {
      if (block.type === 'text' && block.text.trim()) parts.push(block.text.trim())
    }
    const text = parts.join('\n').trim()
    if (text) return text
  }
  return ''
}

function treeSettled(tree: ArticleTree): boolean {
  if (pickReadyNode(tree) !== null) return false
  return !Object.values(tree.nodes).some(node => node.status === 'running')
}

function ensureDriverEvent(session: Session): void {
  if (session.events.some(event => event.type === 'agent/driver')) return
  session.append('agent/driver', { id: WRITEHERE_DRIVER_ID })
}

async function ensureMemoryIndex(session: Session): Promise<void> {
  if (session.events.some(event =>
    event.type === 'user/message'
    && event.data.source.kind === 'plugin'
    && event.data.source.plugin === DRIVER_PLUGIN
    && event.data.content.some(block => block.type === 'text' && block.text.includes(MEMORY_INDEX_OPEN)),
  )) return
  const text = await memoryIndexText(session.header.cwd)
  if (!text) return
  appendContext(session, text)
}

function ensureMethodologyContext(session: Session): void {
  if (session.events.some(event =>
    event.type === 'user/message'
    && event.data.source.kind === 'plugin'
    && event.data.source.plugin === DRIVER_PLUGIN
    && event.data.content.some(block => block.type === 'text' && block.text.includes('<article-methodology>')),
  )) return
  const text = methodologySkillContext()
  if (!text) return
  appendContext(session, text)
}

function formatGetInfo(info: ArticleNodeInfo, instruction: string, extra = ''): string {
  const body = [
    GET_INFO_OPEN,
    JSON.stringify(info),
    GET_INFO_CLOSE,
    '',
    instruction,
  ]
  if (extra) body.push('', extra)
  return body.join('\n')
}

function childrenExtra(tree: ArticleTree, node: ArticleNode): string {
  if (node.children.length === 0) return ''
  const lines = node.children.map((id) => {
    const child = tree.nodes[id]
    if (!child) return `## ${id}\n`
    return `## ${child.id} (${child.type})\n${child.result ?? ''}`
  })
  return `<article-children>\n${lines.join('\n\n')}\n</article-children>`
}

function appendContext(session: Session, text: string): void {
  session.append(
    'user/message',
    createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'plugin', plugin: DRIVER_PLUGIN },
    }),
    { surfaceOp: 'append' },
  )
}

async function persistGetInfo(
  host: SchedulerHost,
  tree: ArticleTree,
  nodeId: string,
  instruction: string,
  extra = '',
  kind: 'planner' | 'execute' = 'execute',
): Promise<void> {
  const draft = await readDraft(host.session.header.cwd, tree.topic)
  const info = kind === 'planner'
    ? getPlannerInfo(tree, nodeId, { draft })
    : getExecuteInfo(tree, nodeId, { draft })
  host.session.append('article/get-info', { info })
  ensureMethodologyContext(host.session)
  await ensureMemoryIndex(host.session)
  if (kind === 'planner') {
    const node = tree.nodes[nodeId]
    const hits = await memoryHitsText(host.session.header.cwd, node?.goal ?? tree.topic)
    if (hits) appendContext(host.session, hits)
  }
  appendContext(host.session, formatGetInfo(info, instruction, extra))
}

function reportTextForChild(session: Session, childId: string): string | null {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i]
    if (event?.type !== 'user/message') continue
    // The subagent plugin owns the `subagent-report` source kind through its
    // own module augmentation; this driver reads it without importing that
    // plugin, so the check stays structural.
    const source = event.data.source as { kind: string; senderSessionId?: string }
    if (source.kind !== 'subagent-report' || source.senderSessionId !== childId) continue
    const text = event.data.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text.trim())
      .filter(Boolean)
      .join('\n')
      .trim()
    return text || null
  }
  return null
}

function settleRunningLabs(session: Session, tree: ArticleTree): ArticleTree {
  let next = tree
  for (const id of tree.order) {
    const node = next.nodes[id]
    if (!node || node.status !== 'running' || !isLabType(node.type)) continue
    const childId = loadLabChildId(session, id)
    if (!childId) continue
    const finding = reportTextForChild(session, childId)
    if (!finding) continue
    next = commitNode(next, id, finding)
  }
  if (next !== tree) saveTree(session, next)
  return next
}

function requireTree(session: Session): ArticleTree {
  const tree = loadTree(session)
  if (!tree) throw new Error('article tree missing after ensure')
  return tree
}

function requireNode(tree: ArticleTree, nodeId: string): ArticleNode {
  const node = tree.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  return node
}

async function updateSelected(
  host: SchedulerHost,
  tree: ArticleTree,
  nodeId: string,
): Promise<ArticleTree> {
  await persistGetInfo(host, tree, nodeId, UPDATE_INSTRUCTION, '', 'planner')
  let update
  try {
    update = parseNodeUpdate(await host.completeText({ responseFormat: UPDATE_RESPONSE_FORMAT }))
  } catch {
    appendContext(host.session, UPDATE_INSTRUCTION)
    update = parseNodeUpdate(await host.completeText({ responseFormat: UPDATE_RESPONSE_FORMAT }))
  }
  const next = setGoal(tree, nodeId, update.goal)
  saveTree(host.session, next)
  host.session.append('article/update', { nodeId, goal: update.goal })
  return next
}

function decideInstructionFor(node: ArticleNode): string {
  return node.type === 'write' ? DECIDE_WRITE_INSTRUCTION : DECIDE_ATOM_INSTRUCTION
}

async function decide(host: SchedulerHost, tree: ArticleTree, nodeId: string): Promise<ReturnType<typeof parseNodeDecision>> {
  const node = requireNode(tree, nodeId)
  await persistGetInfo(host, tree, nodeId, decideInstructionFor(node), '', 'planner')
  try {
    return parseNodeDecision(await host.completeText({ responseFormat: DECIDE_RESPONSE_FORMAT }))
  } catch {
    appendContext(host.session, DECIDE_RETRY_INSTRUCTION)
    return parseNodeDecision(await host.completeText({ responseFormat: DECIDE_RESPONSE_FORMAT }))
  }
}

async function completeProse(host: SchedulerHost): Promise<string> {
  const first = (await host.completeText()).trim()
  if (first) return first
  appendContext(host.session, 'Previous reply was empty. Return the result prose only.')
  const second = (await host.completeText()).trim()
  if (!second) throw new Error('empty model result')
  return second
}

type ContinuableHost = {
  startContinuable: (spec: {
    provider: string
    label: string
    request: {
      prompt: Array<{ type: 'text'; text: string }>
      parent: Agent
      preset: string
      persona: string
    }
    signal: AbortSignal
  }) => Promise<{ childId: string }>
  followup?: (
    parent: Agent,
    childId: string,
    prompt: Array<{ type: 'text'; text: string }>,
    options: { source: { kind: 'coordinator'; form: 'relay'; senderSessionId: string }; signal: AbortSignal },
  ) => Promise<unknown>
  getProvider?: (name: string) => unknown
  list?: () => string[]
}

function labProvider(subagents: ContinuableHost): string {
  if (subagents.getProvider?.('spawn')) return 'spawn'
  const names = subagents.list?.() ?? []
  return names[0] ?? 'spawn'
}

function appendLabUnavailable(host: SchedulerHost): void {
  const message = createAssistantMessage({
    content: [{ type: 'text', text: LAB_UNAVAILABLE_TEXT }],
    source: {
      provider: host.options.provider ?? 'writehere',
      model: host.options.model ?? 'writehere',
    },
  })
  host.session.append(
    'assistant/message',
    { turn: host.turn, step: host.step, message },
    { surfaceOp: 'append' },
  )
}

async function dispatchTask(host: SchedulerHost, tree: ArticleTree, node: ArticleNode): Promise<TickEnd> {
  const subagents = host.ctx.get('subagents') as ContinuableHost | undefined
  if (subagents?.startContinuable === undefined) {
    appendLabUnavailable(host)
    return 'park'
  }
  const retrieval = isRetrievalGoal(node.goal)
  const prompt = [{
    type: 'text' as const,
    text: retrieval ? `${RETRIEVAL_PROMPT_PREFIX}${node.goal}` : node.goal,
  }]
  const existing = loadLabChildId(host.session, node.id)
  try {
    if (existing && typeof subagents.followup === 'function') {
      await subagents.followup(host.self, existing, prompt, {
        source: { kind: 'coordinator', form: 'relay', senderSessionId: host.self.id },
        signal: host.signal,
      })
    } else {
      const started = await subagents.startContinuable({
        provider: labProvider(subagents),
        label: `task:${node.id}`,
        request: {
          prompt,
          parent: host.self,
          preset: 'standard',
          persona: retrieval ? RETRIEVAL_PERSONA : LAB_PERSONA,
        },
        signal: host.signal,
      })
      saveLabChild(host.session, node.id, started.childId)
    }
  } catch {
    appendLabUnavailable(host)
    return 'park'
  }
  saveTree(host.session, markRunning(tree, node.id))
  return 'park'
}

async function executeAtomic(host: SchedulerHost, tree: ArticleTree, node: ArticleNode): Promise<TickEnd> {
  if (isLabType(node.type)) return dispatchTask(host, tree, node)
  const composing = node.type === 'write' && node.children.length > 0 && allChildrenDone(tree, node.id)
  const instruction = node.type === 'think'
    ? EXECUTE_THINK_INSTRUCTION
    : composing ? COMPOSE_WRITE_INSTRUCTION : writeLengthInstruction(node.length)
  await persistGetInfo(host, tree, node.id, instruction, childrenExtra(tree, node), 'execute')
  const result = await completeProse(host)
  const committed = commitNode(tree, node.id, result)
  saveTree(host.session, committed)
  if (node.type === 'write' && node.children.length === 0) {
    await appendWriteSection(host.session.header.cwd, committed.topic, node.goal, result)
  }
  return 'continue'
}

async function tick(host: SchedulerHost, tree: ArticleTree, nodeId: string): Promise<TickEnd> {
  // Paper Algorithm 1: GetInfo → Update(v*, K) → IsAtomic or Execute.
  const current = await updateSelected(host, tree, nodeId)
  const node = requireNode(current, nodeId)
  if (node.children.length > 0 && allChildrenDone(current, nodeId)) {
    return executeAtomic(host, current, node)
  }
  if (!isAtomicFlag(node)) {
    const decision = await decide(host, current, nodeId)
    if (decision.kind === 'atomic') {
      const atomic = markAtomic(current, nodeId)
      saveTree(host.session, atomic)
      return executeAtomic(host, atomic, requireNode(atomic, nodeId))
    }
    saveTree(host.session, decomposeNode(current, nodeId, decision.children))
    return 'continue'
  }
  return executeAtomic(host, current, node)
}

/**
 * Run scheduler ticks until the tree is silent or a task card parks.
 * @param host - live WriteHere agent envelope
 * @returns `completed` when no ready node remains or a task is waiting
 */
export async function runWriteHereScheduler(host: SchedulerHost): Promise<'completed'> {
  ensureDriverEvent(host.session)
  const topic = latestUserText(host.session)
  const existing = loadTree(host.session)
  if (!existing) {
    if (!topic) return 'completed'
    ensureTree(host.session, topic)
  } else if (treeSettled(settleRunningLabs(host.session, existing)) && topic && topic !== existing.topic) {
    startTree(host.session, topic)
  }

  for (let i = 0; i < MAX_TICKS; i++) {
    const tree = settleRunningLabs(host.session, requireTree(host.session))
    const nodeId = pickReadyNode(tree)
    if (nodeId === null) return 'completed'
    const end = await tick(host, tree, nodeId)
    if (end === 'park') return 'completed'
  }
  throw new Error('writehere scheduler exceeded the per-turn tick limit')
}

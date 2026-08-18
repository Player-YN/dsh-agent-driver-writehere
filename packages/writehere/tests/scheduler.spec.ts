import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  GET_INFO_CLOSE,
  GET_INFO_OPEN,
  MEMORY_INDEX_OPEN,
  MEMORY_OPEN,
  LAB_UNAVAILABLE_TEXT,
  RETRIEVAL_PERSONA,
  RETRIEVAL_PROMPT_PREFIX,
  WriteHereAgent,
} from '../src/index.ts'
import { loadTree } from '../src/tree.ts'
// Session-event augmentations for the event.type comparisons below.
import type {} from '../src/types.ts'
import type {} from '@deepseek-ai/dsh-article-tree/src/types.ts'
import { MockAdapter, textResponse } from './mock-adapter.ts'
import { messageBlob, mountWriteHereHarness, send } from './harness.ts'

const UPDATE = '{"goal":"refined-goal"}'
const RETRIEVAL_UPDATE = '{"goal":"查公开榜并交回证据"}'
const ATOMIC = '{"atomic":true}'

const PLAN = JSON.stringify({
  atomic: false,
  children: [
    { type: 'think', goal: '定尺子', atomic: true },
    { type: 'write', goal: '写开篇', atomic: true },
  ],
})

const SEARCH_PLAN = JSON.stringify({
  atomic: false,
  children: [
    { type: 'task', goal: '查公开榜', atomic: true },
    { type: 'write', goal: '写开篇', atomic: true },
  ],
})

const SIBLING_WRITES = JSON.stringify({
  atomic: false,
  children: [
    { type: 'write', goal: '先写', atomic: true },
    { type: 'write', goal: '后写', atomic: true },
  ],
})

function infoPayload(messages: Message[] | undefined): Record<string, unknown> {
  for (const message of messages ?? []) {
    if (message.role !== 'user') continue
    const text = message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('')
    const start = text.indexOf(GET_INFO_OPEN)
    if (start < 0) continue
    const end = text.indexOf(GET_INFO_CLOSE, start)
    if (end < 0) continue
    return JSON.parse(text.slice(start + GET_INFO_OPEN.length, end).trim()) as Record<string, unknown>
  }
  throw new Error('no get-info envelope')
}

function getInfoCount(messages: Message[] | undefined): number {
  let count = 0
  for (const message of messages ?? []) {
    if (message.role !== 'user') continue
    const text = message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('')
    if (text.includes(GET_INFO_OPEN)) count += 1
  }
  return count
}

describe('WriteHere scheduler', () => {
  it('Updates then decides, commits write/think, logs GetInfo without ledgerHits, and appends leaf draft only', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-'))
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(PLAN),
      textResponse(UPDATE),
      textResponse('尺子是对照 4.6 与 0813。'),
      textResponse(UPDATE),
      textResponse('开篇写现象，不写术语。'),
      textResponse(UPDATE),
      textResponse('合成后的开篇：对照两份成绩单。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('sched'),
      meta: { agentPreset: 'article-editor', cwd },
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    expect(agent).toBeInstanceOf(WriteHereAgent)

    send(agent, '对照 4.6 与 0813')
    await agent.whenIdle()

    const tree = loadTree(agent.session)
    expect(tree).not.toBeNull()
    expect(tree!.nodes.root?.status).toBe('done')
    expect(tree!.nodes.root?.result).toContain('合成后的开篇')
    expect(agent.session.events.some(event => event.type === 'agent/driver' && event.data.id === 'writehere')).toBe(true)
    expect(agent.session.events.some(event => event.type === 'article/get-info')).toBe(true)
    expect(agent.session.events.some(event =>
      event.type === 'article/update' && event.data.nodeId === 'root',
    )).toBe(true)
    expect(adapter.requests.length).toBe(8)
    expect(adapter.requests.every(request => request.tools === undefined || request.tools.length === 0)).toBe(true)
    expect(adapter.requests.every(request => getInfoCount(request.messages) <= 1)).toBe(true)
    expect(infoPayload(adapter.requests[0]?.messages).graph).toEqual(expect.any(Array))
    expect(infoPayload(adapter.requests[0]?.messages)).not.toHaveProperty('ledgerHits')
    const compose = adapter.requests[7]
    expect(infoPayload(compose?.messages).graph).toBeUndefined()
    expect(infoPayload(compose?.messages)).not.toHaveProperty('ledgerHits')
    expect(adapter.requests[0]?.responseFormat).toEqual({ type: 'json_object' })
    expect(adapter.requests[1]?.responseFormat).toEqual({ type: 'json_object' })
    expect(adapter.requests[3]?.responseFormat).toBeUndefined()
    expect(adapter.requests.some(request => messageBlob(request.messages).includes('延迟揭晓'))).toBe(true)

    const draft = await readFile(join(cwd, 'article.md'), 'utf8')
    expect(draft).toContain('开篇写现象')
    expect(draft).not.toContain('合成后的开篇')
  })

  it('dispatches a retrieval task with a specialized persona and prompt, not a bare goal', async () => {
    const calls: Array<{ request?: { preset?: string; persona?: string; prompt?: Array<{ text?: string }> } }> = []
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(SEARCH_PLAN),
      textResponse(RETRIEVAL_UPDATE),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    ctx.provide('subagents', {
      startContinuable: (spec: { request?: { preset?: string; persona?: string; prompt?: Array<{ text?: string }> } }) => {
        calls.push(spec)
        return Promise.resolve({ childId: 'lab-1', messageId: 'm1' })
      },
    })
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('search'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })

    send(agent, '对照 4.6 与 0813')
    await agent.whenIdle()

    expect(calls).toHaveLength(1)
    expect(calls[0]?.request?.preset).toBe('standard')
    expect(calls[0]?.request?.persona).toBe(RETRIEVAL_PERSONA)
    expect(calls[0]?.request?.prompt?.[0]?.text).toContain(RETRIEVAL_PROMPT_PREFIX)
    expect(calls[0]?.request?.prompt?.[0]?.text).toContain('查公开榜')
    const tree = loadTree(agent.session)
    const searchId = tree?.nodes.root?.children[0]
    expect(searchId).toBeDefined()
    expect(tree?.nodes[searchId!]?.status).toBe('running')
    expect(tree?.nodes[searchId!]?.type).toBe('task')
    expect(agent.session.events.some(event =>
      event.type === 'article/lab' && event.data.nodeId === searchId && event.data.childId === 'lab-1',
    )).toBe(true)
  })

  it('commits a running task when the lab reports and continues the parent write', async () => {
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(SEARCH_PLAN),
      textResponse(RETRIEVAL_UPDATE),
      textResponse(UPDATE),
      textResponse('公开榜停在 8 月 7 日。'),
      textResponse(UPDATE),
      textResponse('合成后的开篇。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    ctx.provide('subagents', {
      startContinuable: () => Promise.resolve({ childId: 'lab-1', messageId: 'm1' }),
    })
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('report'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    send(agent, '对照 4.6 与 0813')
    await agent.whenIdle()

    agent.followup(createUserMessage({
      content: [
        { type: 'text', text: 'Background subagent lab-1 reported:' },
        { type: 'text', text: '公开榜停在 8 月 7 日。' },
      ],
      source: { kind: 'subagent-report', form: 'relay', senderSessionId: SessionId('lab-1') },
    }))
    await agent.whenIdle()

    const tree = loadTree(agent.session)
    const searchId = tree?.nodes.root?.children[0]
    expect(tree?.nodes[searchId!]?.status).toBe('done')
    expect(tree?.nodes[searchId!]?.result).toContain('公开榜停在')
    expect(tree?.nodes.root?.status).toBe('done')
  })

  it('Updates a sibling write after its predecessor finishes before executing it', async () => {
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(SIBLING_WRITES),
      textResponse(UPDATE),
      textResponse('第一段。'),
      textResponse(UPDATE),
      textResponse('第二段。'),
      textResponse(UPDATE),
      textResponse('合成两段。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('siblings'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })

    send(agent, '对照两段')
    await agent.whenIdle()

    const tree = loadTree(agent.session)
    const [first, second] = tree?.nodes.root?.children ?? []
    expect(tree?.nodes[second!]?.dependsOn).toEqual([first])
    expect(tree?.nodes[first!]?.status).toBe('done')
    expect(tree?.nodes[second!]?.status).toBe('done')
    const updates = agent.session.events.filter(event => event.type === 'article/update')
    expect(updates.some(event => event.type === 'article/update' && event.data.nodeId === second)).toBe(true)
    expect(tree?.nodes.root?.status).toBe('done')
  })

  it('starts a new tree when the previous tree is settled and the user sends a new topic', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-'))
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(ATOMIC),
      textResponse('第一篇正文。'),
      textResponse(UPDATE),
      textResponse(ATOMIC),
      textResponse('第二篇正文。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('retree'),
      meta: { agentPreset: 'article-editor', cwd },
      agentOptions: { provider: 'mock', model: 'mock' },
    })

    send(agent, '第一题')
    await agent.whenIdle()
    expect(loadTree(agent.session)?.topic).toBe('第一题')
    expect(loadTree(agent.session)?.nodes.root?.status).toBe('done')

    send(agent, '第二题')
    await agent.whenIdle()
    const tree = loadTree(agent.session)
    expect(tree?.topic).toBe('第二题')
    expect(tree?.nodes.root?.status).toBe('done')
    expect(tree?.nodes.root?.result).toContain('第二篇正文')
  })

  it('surfaces lab unavailable and does not commit the task node', async () => {
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(SEARCH_PLAN),
      textResponse(RETRIEVAL_UPDATE),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('nolab'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })

    send(agent, '对照 4.6 与 0813')
    await agent.whenIdle()

    const tree = loadTree(agent.session)
    const searchId = tree?.nodes.root?.children[0]
    expect(tree?.nodes[searchId!]?.status).toBe('ready')
    expect(tree?.nodes[searchId!]?.result).toBeNull()
    const assistant = agent.session.events.findLast(event => event.type === 'assistant/message')
    expect(assistant?.type === 'assistant/message' && assistant.data.message.content.some(
      block => block.type === 'text' && block.text.includes(LAB_UNAVAILABLE_TEXT),
    )).toBe(true)
  })

  it('treats a throwing startContinuable as lab unavailable', async () => {
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(SEARCH_PLAN),
      textResponse(RETRIEVAL_UPDATE),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    ctx.provide('subagents', {
      startContinuable: () => Promise.reject(new Error('provider down')),
    })
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('labfail'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })

    send(agent, '对照 4.6 与 0813')
    await agent.whenIdle()

    const searchId = loadTree(agent.session)?.nodes.root?.children[0]
    expect(loadTree(agent.session)?.nodes[searchId!]?.status).toBe('ready')
  })

  it('retries a malformed update and a malformed decision once', async () => {
    const adapter = new MockAdapter([
      textResponse('not-json'),
      textResponse(UPDATE),
      textResponse('not-json'),
      textResponse(ATOMIC),
      textResponse('一段成稿。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('retry'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })

    send(agent, '对照 4.6 与 0813')
    await agent.whenIdle()

    expect(loadTree(agent.session)?.nodes.root?.status).toBe('done')
    expect(adapter.requests).toHaveLength(5)
    expect(adapter.requests[0]?.responseFormat).toEqual({ type: 'json_object' })
    expect(adapter.requests[1]?.responseFormat).toEqual({ type: 'json_object' })
    expect(adapter.requests[2]?.responseFormat).toEqual({ type: 'json_object' })
    expect(adapter.requests[3]?.responseFormat).toEqual({ type: 'json_object' })
    expect(adapter.requests[4]?.responseFormat).toBeUndefined()
  })

  it('does not send decide keys on the Update tick', async () => {
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(ATOMIC),
      textResponse('成稿。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('shape'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    send(agent, '对照稿')
    await agent.whenIdle()
    const first = messageBlob(adapter.requests[0] as GenerateOptions)
    expect(first).toContain('refine THIS selected node')
    expect(first).not.toContain('trailing-publish')
    expect(first).not.toMatch(/reviseParent|revise-parent|article_revise_parent/)
  })

  it('injects path-only memory outside the GetInfo JSON', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-memsched-'))
    await mkdir(join(cwd, 'ledger'), { recursive: true })
    await writeFile(join(cwd, 'article.md'), '对照稿必须写回观察。', 'utf8')
    await writeFile(join(cwd, 'ledger', 'concepts.jsonl'), `${JSON.stringify({
      id: 'c1',
      name: '写回',
      firstArticle: 'article.md',
    })}\n`, 'utf8')
    const adapter = new MockAdapter([
      textResponse(UPDATE),
      textResponse(ATOMIC),
      textResponse('成稿。'),
    ])
    const ctx = await mountWriteHereHarness(adapter)
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('memory'),
      meta: { agentPreset: 'article-editor', cwd },
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    send(agent, '对照稿')
    await agent.whenIdle()
    const first = messageBlob(adapter.requests[0] as GenerateOptions)
    expect(first).toContain(MEMORY_INDEX_OPEN)
    expect(first).toContain(MEMORY_OPEN)
    expect(infoPayload(adapter.requests[0]?.messages)).not.toHaveProperty('ledgerHits')
    expect(JSON.stringify(infoPayload(adapter.requests[0]?.messages))).not.toContain(MEMORY_OPEN)
  })
})

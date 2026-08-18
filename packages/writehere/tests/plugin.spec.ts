import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import { apply, WriteHereAgent } from '../src/index.ts'
import { MockAdapter, textResponse } from './mock-adapter.ts'
import { mountWriteHereHarness } from './harness.ts'

function sessionWithPreset(agentPreset: string): Session {
  return { header: { agentPreset } } as Session
}

describe('host bind', () => {
  it('constructs WriteHereAgent when header.agentPreset is article-editor', async () => {
    const ctx = await mountWriteHereHarness(new MockAdapter([textResponse('{"atomic":true}')]))
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('editor'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    expect(agent).toBeInstanceOf(WriteHereAgent)
    expect(ctx.agentDrivers.resolve(agent.session)).toBe(WriteHereAgent)
  })

  it('constructs ReactLoopAgent for a standard preset while writehere is loaded', async () => {
    const ctx = await mountWriteHereHarness(new MockAdapter([textResponse('ok')]))
    const { agent } = await ctx.agents.create({
      sessionId: SessionId('standard'),
      meta: { agentPreset: 'standard' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    expect(agent).not.toBeInstanceOf(WriteHereAgent)
    expect(agent.constructor.name).toBe('ReactLoopAgent')
  })

  it('refuses ReactLoop when article-editor has no bound driver', async () => {
    const ctx = await mountWriteHereHarness(new MockAdapter([textResponse('ok')]), { bind: false })
    await expect(ctx.agents.create({
      sessionId: SessionId('unbound'),
      meta: { agentPreset: 'article-editor' },
      agentOptions: { provider: 'mock', model: 'mock' },
    })).rejects.toThrow('requires WriteHereAgent')
  })

  it('unwinds register and bind when the writehere plugin unloads', async () => {
    const ctx = await mountWriteHereHarness(new MockAdapter([textResponse('ok')]), { bind: false })
    const child = ctx.plugin(Object.assign((inner: typeof ctx) => {
      apply(inner)
    }, { inject: ['agentDrivers'] }))
    await child.await()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(WriteHereAgent)
    await child.dispose()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()
  })
})

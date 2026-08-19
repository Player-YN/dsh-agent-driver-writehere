import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { hookAgentLoopPrepare } from '../src/prepare-hook.ts'

function sessionWithPreset(agentPreset?: string) {
  return { header: { agentPreset } } as { header: { agentPreset?: string } }
}

function stockPrepare(this: { last?: string }) {
  this.last = 'orig'
  return { via: 'orig' }
}

describe('hookAgentLoopPrepare', () => {
  it('leaves a host prepare that already looks up agentDrivers', () => {
    const ctx = new Context()
    function prepare() {
      const drivers = this.runtime.ctx.get('agentDrivers')
      return drivers
    }
    const loop = { prepare, runtime: { ctx }, ctx, ownership: {} }
    ctx.provide('agentLoop', loop)
    hookAgentLoopPrepare(ctx)
    expect(loop.prepare).toBe(prepare)
  })

  it('sends unbound standard sessions through the original prepare (React stays default)', () => {
    const ctx = new Context()
    const loop = {
      last: '',
      prepare: stockPrepare,
      runtime: { ctx },
      ctx,
      ownership: {},
    }
    ctx.provide('agentLoop', loop)
    ctx.provide('agentDrivers', { resolve: () => undefined })
    hookAgentLoopPrepare(ctx)
    const result = loop.prepare(
      { fiber: { assertActive() {} } },
      's',
      {},
      sessionWithPreset('standard'),
    )
    expect(loop.last).toBe('orig')
    expect(result).toEqual({ via: 'orig' })
  })

  it('refuses React fallback for a WriteHere-bound preset with no live constructor', () => {
    const ctx = new Context()
    const loop = { prepare: stockPrepare, runtime: { ctx }, ctx, ownership: {} }
    ctx.provide('agentLoop', loop)
    ctx.provide('agentDrivers', { resolve: () => undefined })
    hookAgentLoopPrepare(ctx)
    expect(() => loop.prepare(
      { fiber: { assertActive() {} } },
      's',
      {},
      sessionWithPreset('article-editor'),
    )).toThrow('requires WriteHereAgent')
  })

  it('constructs the bound driver instead of calling stock prepare', () => {
    class FakeDriver {
      static count = 0
      readonly scope = { dispose: async () => {} }
      readonly ctx = {
        sessions: { enter: () => () => {}, announce() {} },
      }
      constructor() { FakeDriver.count += 1 }
      cancel() {}
      whenIdle() { return Promise.resolve() }
    }
    const ctx = new Context()
    const agents = { enter: () => () => {}, announce() {} }
    const runtimeCtx = Object.assign(ctx, { agents })
    const loop = {
      last: '',
      prepare: stockPrepare,
      runtime: { ctx: runtimeCtx },
      ctx: { logger: { info() {} } },
      ownership: {
        isActive: () => true,
        signal: new AbortController().signal,
        track: () => () => {},
      },
    }
    ctx.provide('agentLoop', loop)
    ctx.provide('agentDrivers', { resolve: () => FakeDriver })
    hookAgentLoopPrepare(ctx)
    const ownerCtx = {
      fiber: { assertActive() {} },
      effect: (fn: () => unknown) => fn(),
      agent: undefined,
    }
    FakeDriver.count = 0
    const prepared = loop.prepare(ownerCtx, 's', {}, sessionWithPreset('article-editor'))
    expect(loop.last).toBe('')
    expect(FakeDriver.count).toBe(1)
    expect(prepared.agent).toBeInstanceOf(FakeDriver)
  })
})

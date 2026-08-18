import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import { createScope } from '@deepseek-ai/dsh-scope'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentDrivers, { type AgentDriverCtor } from '../src/index.ts'
import * as AgentDriversInvariant from '../src/invariant.ts'

/** Constructor used only as a resolve() identity; prepare never calls it here. */
class FakeDriver {
  constructor(
    readonly loopCtx: Context,
    readonly id: SessionId,
    readonly options: AgentOptions,
    readonly session: Session,
  ) {}
}

/** Second constructor to prove a duplicate register does not replace the first. */
class OtherDriver extends FakeDriver {}

function sessionWithPreset(agentPreset?: string): Session {
  return { header: agentPreset === undefined ? {} : { agentPreset } } as Session
}

async function boot(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(AgentDrivers)
  return ctx
}

describe('AgentDrivers', () => {
  it('resolves header.agentPreset through bind then register', async () => {
    const ctx = await boot()
    ctx.agentDrivers.bindPreset('article-editor', 'fake')
    ctx.agentDrivers.register('fake', FakeDriver as unknown as AgentDriverCtor)
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(FakeDriver)
  })

  it('returns undefined when the header, bind, or constructor is missing', async () => {
    const ctx = await boot()
    expect(ctx.agentDrivers.resolve(sessionWithPreset())).toBeUndefined()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()

    ctx.agentDrivers.bindPreset('article-editor', 'fake')
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('standard'))).toBeUndefined()

    ctx.agentDrivers.register('fake', FakeDriver as unknown as AgentDriverCtor)
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(FakeDriver)
    expect(ctx.agentDrivers.resolve(sessionWithPreset('standard'))).toBeUndefined()
  })

  it('throws on a second live register or bind of the same id', async () => {
    const ctx = await boot()
    ctx.agentDrivers.register('fake', FakeDriver as unknown as AgentDriverCtor)
    ctx.agentDrivers.bindPreset('article-editor', 'fake')

    expect(() => ctx.agentDrivers.register('fake', OtherDriver as unknown as AgentDriverCtor))
      .toThrow('agent driver "fake" is already registered')
    expect(() => ctx.agentDrivers.bindPreset('article-editor', 'other'))
      .toThrow('agent preset "article-editor" is already bound to a driver')
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(FakeDriver)
  })

  it('rejects empty ids before recording an entry', async () => {
    const ctx = await boot()
    expect(() => ctx.agentDrivers.register('', FakeDriver as unknown as AgentDriverCtor))
      .toThrow('agent driver id must be a non-empty string')
    expect(() => ctx.agentDrivers.bindPreset('', 'fake'))
      .toThrow('agent preset id must be a non-empty string')
    expect(() => ctx.agentDrivers.bindPreset('article-editor', ''))
      .toThrow('agent driver id must be a non-empty string')
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()
  })

  it('unwinds register and bind with the registering plugin', async () => {
    const ctx = await boot()
    const child = ctx.plugin(Object.assign((inner: Context) => {
      inner.agentDrivers.register('fake', FakeDriver as unknown as AgentDriverCtor)
      inner.agentDrivers.bindPreset('article-editor', 'fake')
    }, { inject: ['agentDrivers'] }))
    await child.await()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(FakeDriver)

    await child.dispose()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()

    ctx.agentDrivers.register('fake', OtherDriver as unknown as AgentDriverCtor)
    ctx.agentDrivers.bindPreset('article-editor', 'fake')
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(OtherDriver)
  })

  it('unwinds bind and register independently via the returned disposer', async () => {
    const ctx = await boot()
    const unbind = ctx.agentDrivers.bindPreset('article-editor', 'fake')
    const unregister = ctx.agentDrivers.register('fake', FakeDriver as unknown as AgentDriverCtor)
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(FakeDriver)

    unbind()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()
    ctx.agentDrivers.bindPreset('article-editor', 'fake')
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBe(FakeDriver)

    unregister()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()
  })

  it('refuses register and bind from an agent or preset scope', async () => {
    const ctx = await boot()
    const host = ctx.plugin(Object.assign((inner: Context) => {
      const scope = createScope(inner, { id: 'agent' })
      const row = scope.ctx.plugin(Object.assign((scoped: Context) => {
        expect(() => scoped.agentDrivers.register('fake', FakeDriver as unknown as AgentDriverCtor))
          .toThrow('agentDrivers.register() requires a host context (not an agent or preset scope)')
        expect(() => scoped.agentDrivers.bindPreset('article-editor', 'fake'))
          .toThrow('agentDrivers.bindPreset() requires a host context (not an agent or preset scope)')
      }, { inject: ['agentDrivers'] }))
      return () => {
        void row.dispose()
        return scope.dispose()
      }
    }, { inject: ['agentDrivers'] }))
    await host.await()
    expect(ctx.agentDrivers.resolve(sessionWithPreset('article-editor'))).toBeUndefined()
    await host.dispose()
  })

  it('registers the empty invariant companion', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    await expect(ctx.plugin(AgentDriversInvariant).then(() => undefined)).resolves.toBeUndefined()
  })
})

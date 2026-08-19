/**
 * Stock DSH 0.1.0-rc.7 AgentLoop.prepare always does `new ReactLoopAgent`.
 * When the host already looks up ctx.agentDrivers, leave that prepare alone.
 * Otherwise wrap this loop instance: bound presets construct the resolved
 * driver; unbound presets still call the original prepare (React).
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent'
import { emitAgentEvent } from '@deepseek-ai/dsh-agent'
import type { AgentDriverCtor } from '@deepseek-ai/dsh-agent-drivers'
import type { Scope } from '@deepseek-ai/dsh-scope'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'
import { WRITEHERE_BOUND_PRESETS } from './ids.ts'

type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact'

const boundPresets = new Set<string>(WRITEHERE_BOUND_PRESETS)

type PreparedDriver = Agent & { readonly scope: Scope }

type PrepareFn = (
  ownerCtx: Context,
  id: SessionId,
  options: AgentOptions,
  session: Session,
  callerSignal?: AbortSignal,
) => PreparedHandle

interface PreparedHandle {
  agent: PreparedDriver
  signal: AbortSignal
  publish: (source: SessionStartSource) => { agent: Agent; dispose: () => Promise<void> }
  dispose: () => Promise<void>
}

interface LoopLike {
  runtime: { ctx: Context }
  ctx: Context
  ownership: {
    isActive(): boolean
    readonly signal: AbortSignal
    track(dispose: (ownerTriggered?: boolean) => Promise<void>): () => void
  }
  prepare: PrepareFn
}

function assertAgentOptions(options: AgentOptions): void {
  if (options.maxTokens !== undefined
    && (!Number.isSafeInteger(options.maxTokens) || options.maxTokens <= 0)) {
    throw new TypeError('agent maxTokens must be a positive safe integer')
  }
}

function hostLooksUpDrivers(prepare: PrepareFn): boolean {
  return Function.prototype.toString.call(prepare).includes('agentDrivers')
}

function exclusiveWriteHerePreset(preset: string | undefined): boolean {
  return preset !== undefined && boundPresets.has(preset)
}

/**
 * Same lifecycle as stock AgentLoop.prepare, with a caller-chosen constructor.
 * Used only when a driver is bound; React still goes through the original prepare.
 */
function prepareWithCtor(
  loop: LoopLike,
  Ctor: AgentDriverCtor,
  ownerCtx: Context,
  id: SessionId,
  options: AgentOptions,
  session: Session,
  callerSignal?: AbortSignal,
): PreparedHandle {
  assertAgentOptions(options)
  ownerCtx.fiber.assertActive()
  if (!loop.ownership.isActive()) throw new Error('agent loop is not active')
  if (callerSignal?.aborted) {
    throw callerSignal.reason instanceof Error
      ? callerSignal.reason
      : new Error(`agent "${id}" creation aborted`, { cause: callerSignal.reason })
  }
  const loopCtx = loop.runtime.ctx
  const abort = new AbortController()
  const onCallerAbort = (): void => {
    abort.abort(callerSignal?.reason instanceof Error
      ? callerSignal.reason
      : new Error(`agent "${id}" creation aborted`, { cause: callerSignal?.reason }))
  }
  const onFactoryTeardown = (): void => { abort.abort(loop.ownership.signal.reason) }
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
  loop.ownership.signal.addEventListener('abort', onFactoryTeardown, { once: true })

  let machine: PreparedDriver | undefined
  let detachSession: (() => void) | undefined
  let detachAgent: (() => void) | undefined
  let disposing: Promise<void> | undefined
  const machineReady = Promise.withResolvers<void>()
  const dispose = (ownerTriggered = false): Promise<void> => (disposing ??= (async () => {
    abort.abort(new Error(`agent "${id}" lifecycle disposed`))
    callerSignal?.removeEventListener('abort', onCallerAbort)
    loop.ownership.signal.removeEventListener('abort', onFactoryTeardown)
    try {
      if (machine === undefined) await machineReady.promise
      if (machine !== undefined) {
        machine.cancel({ kind: 'disposed' })
        await machine.whenIdle()
        await machine.scope.dispose()
      }
    } finally {
      try {
        detachAgent?.()
        detachSession?.()
      } finally {
        untrack()
        if (!ownerTriggered) await unfollowOwner()
      }
    }
  })())
  const untrack = loop.ownership.track(dispose)
  let unfollowOwner: () => Promise<void> | void
  try {
    unfollowOwner = ownerCtx.effect(() => () => {
      if (disposing !== undefined) return
      abort.abort(new Error(`agent "${id}" setup aborted: owner disposed during setup`))
      return dispose(true)
    }, `agentLoop.lifecycle(${id})`)
  } catch (error: unknown) {
    untrack()
    callerSignal?.removeEventListener('abort', onCallerAbort)
    loop.ownership.signal.removeEventListener('abort', onFactoryTeardown)
    throw error
  }

  const assertLive = (): void => {
    if (!abort.signal.aborted) return
    throw abort.signal.reason instanceof Error ? abort.signal.reason : new Error(String(abort.signal.reason))
  }
  try {
    const preset = session.header.agentPreset
    loop.ctx.logger.info(`prepare driver=${Ctor.name} preset=${preset ?? '(none)'} session=${id}`)
    const agent = machine = new Ctor(loopCtx, id, options, session)
    machineReady.resolve()
    assertLive()
    return {
      agent,
      signal: abort.signal,
      publish: (source) => {
        assertLive()
        detachSession = agent.ctx.sessions.enter(session)
        detachAgent = loopCtx.agents.enter(agent, ownerCtx.agent)
        agent.ctx.sessions.announce(session)
        assertLive()
        loopCtx.agents.announce(agent)
        assertLive()
        emitAgentEvent(loopCtx, agent, 'agent/session-start', { source })
        assertLive()
        return { agent, dispose }
      },
      dispose,
    }
  } catch (error: unknown) {
    machineReady.resolve()
    void dispose()
    throw error
  }
}

/** Wrap stock prepare on this loop instance; no-op when the host already resolves drivers. */
export function hookAgentLoopPrepare(ctx: Context): void {
  const loop = ctx.get('agentLoop') as LoopLike | undefined
  if (loop === undefined || typeof loop.prepare !== 'function') return
  const orig = loop.prepare
  if (hostLooksUpDrivers(orig)) return

  const hooked: PrepareFn = function (
    this: LoopLike,
    ownerCtx,
    id,
    options,
    session,
    callerSignal,
  ) {
    const resolved = ctx.get('agentDrivers')?.resolve(session)
    const preset = session.header.agentPreset
    if (resolved === undefined) {
      if (exclusiveWriteHerePreset(preset)) {
        throw new Error(`preset "${preset}" requires WriteHereAgent; ReactLoop is not a fallback`)
      }
      return orig.call(this, ownerCtx, id, options, session, callerSignal)
    }
    return prepareWithCtor(this, resolved, ownerCtx, id, options, session, callerSignal)
  }

  ctx.effect(() => {
    loop.prepare = hooked
    return () => { loop.prepare = orig }
  }, 'writehere.hookPrepare()')
}

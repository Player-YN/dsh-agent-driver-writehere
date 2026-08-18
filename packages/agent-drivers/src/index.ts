/**
 * Host-plane registry of Agent constructors selected from session.header.agentPreset.
 *
 * @module @deepseek-ai/dsh-agent-drivers
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import type { Scope } from '@deepseek-ai/dsh-scope'
import type { Session, SessionId } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host-plane Agent constructor registry. Optional at AgentLoop: missing means ReactLoopAgent. */
    agentDrivers: AgentDrivers
  }
}

/** Constructed driver: a live Agent plus the scope the factory must unwind. */
export interface AgentDriverInstance extends Agent {
  readonly scope: Scope
}

/** Constructor AgentLoop.prepare invokes in place of ReactLoopAgent. */
export type AgentDriverCtor = new (
  loopCtx: Context,
  id: SessionId,
  options: AgentOptions,
  session: Session,
) => AgentDriverInstance

/** Host-plane Agent constructor registry (`ctx.agentDrivers`). */
export class AgentDrivers extends Service {
  private readonly drivers = new Map<string, AgentDriverCtor>()
  private readonly bindings = new Map<string, string>()

  constructor(ctx: Context) {
    super(ctx, 'agentDrivers')
  }

  /**
   * Register a named constructor. Duplicate live ids throw; disposing the
   * returned effect (or unloading the registering plugin) frees the id.
   * @param id - non-empty driver id.
   * @param ctor - constructor matching the AgentLoop.prepare call.
   * @returns the exact Cordis effect disposer.
   */
  register(id: string, ctor: AgentDriverCtor): () => void {
    this.assertHostPlane('agentDrivers.register()')
    assertNonEmpty(id, 'agent driver id')
    const dispose = this.ctx.effect(() => {
      if (this.drivers.has(id)) {
        throw new Error(`agent driver "${id}" is already registered`)
      }
      this.drivers.set(id, ctor)
      return () => { this.drivers.delete(id) }
    }, 'agentDrivers.register()')
    // oxlint-disable-next-line typescript/no-misused-promises -- synchronous cleanup; direct return preserves disposer identity
    return dispose
  }

  /**
   * Bind a session `header.agentPreset` value to a registered driver id.
   * The driver need not be registered yet; {@link resolve} returns undefined
   * until both the bind and the constructor are live. Duplicate live preset
   * ids throw; disposing the effect frees the preset.
   * @param presetId - non-empty preset id written on the session header.
   * @param driverId - non-empty driver id passed to {@link register}.
   * @returns the exact Cordis effect disposer.
   */
  bindPreset(presetId: string, driverId: string): () => void {
    this.assertHostPlane('agentDrivers.bindPreset()')
    assertNonEmpty(presetId, 'agent preset id')
    assertNonEmpty(driverId, 'agent driver id')
    const dispose = this.ctx.effect(() => {
      if (this.bindings.has(presetId)) {
        throw new Error(`agent preset "${presetId}" is already bound to a driver`)
      }
      this.bindings.set(presetId, driverId)
      return () => { this.bindings.delete(presetId) }
    }, 'agentDrivers.bindPreset()')
    // oxlint-disable-next-line typescript/no-misused-promises -- synchronous cleanup; direct return preserves disposer identity
    return dispose
  }

  /**
   * Look up the constructor for this session: `header.agentPreset` → bind → ctor.
   * Missing header, unbound preset, or unbound driver yields `undefined` so
   * AgentLoop can fall back to ReactLoopAgent.
   * @param session - session whose header may name an agent preset.
   * @returns the live constructor, or `undefined` when nothing is bound.
   */
  resolve(session: Session): AgentDriverCtor | undefined {
    const presetId = session.header.agentPreset
    if (presetId === undefined) return undefined
    const driverId = this.bindings.get(presetId)
    if (driverId === undefined) return undefined
    return this.drivers.get(driverId)
  }

  /** Refuse agent/preset-scoped registration: construct happens before preset mount. */
  private assertHostPlane(method: string): void {
    if (scopeOf(this.ctx) !== undefined) {
      throw new Error(`${method} requires a host context (not an agent or preset scope)`)
    }
  }
}

/** Reject empty registry keys before they can shadow a missing bind. */
function assertNonEmpty(value: string, label: string): void {
  if (value.length === 0) throw new Error(`${label} must be a non-empty string`)
}

export default AgentDrivers

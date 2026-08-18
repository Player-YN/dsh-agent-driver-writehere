/**
 * Package-owned invariant companion for the Agent constructor registry.
 *
 * No runtime invariant: this package owns a host-plane constructor table and
 * preset bindings; it emits no events and holds no model or session snapshot
 * for a companion to check.
 *
 * @module @deepseek-ai/dsh-agent-drivers/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-agent-drivers'

/** Cordis companion plugin name. */
export const name = 'agent-drivers-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: the registry has no event or snapshot relationship to check. */
const install: InvariantInstaller = () => {}

/**
 * Register the intentionally empty invariant contribution.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */

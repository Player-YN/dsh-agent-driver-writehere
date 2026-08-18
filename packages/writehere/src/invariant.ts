/**
 * Package-owned invariant companion for the WriteHere editor driver.
 *
 * No runtime invariant: this package registers a host-plane constructor and
 * appends snapshot events (`agent/driver`, `article/get-info`, `article/tree`).
 * Reconstructability is the session log itself; there is no cross-event
 * enclosure this companion can check independently of dsh-session.
 *
 * @module @deepseek-ai/dsh-writehere/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-writehere'

/** Cordis companion plugin name. */
export const name = 'writehere-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** No runtime invariant: driver registration and snapshot events have no companion relation to check. */
const install: InvariantInstaller = () => {}

/**
 * Register the intentionally empty invariant contribution.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */

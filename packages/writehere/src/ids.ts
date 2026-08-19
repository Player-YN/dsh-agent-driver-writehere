/** Host-plane driver id registered on `ctx.agentDrivers`. */
export const WRITEHERE_DRIVER_ID = 'writehere'

/**
 * Preset ids this plugin binds to WriteHere.
 * Unbound presets stay on stock ReactLoop — React is not disabled.
 * A bound id without a live constructor must not silently fall back to React.
 */
export const WRITEHERE_BOUND_PRESETS = ['article-editor', 'xieka'] as const

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

/** Must match apps/cli/config/agent-presets/article-editor. */
export const EDITOR_PRESET_ID = 'article-editor'

export function currentSessionPreset(ctx: ClientContext): string | undefined {
  const list = ctx.sessions.list.getSnapshot()
  const id = list.current
  if (!id) return undefined
  return list.byId[id]?.agentPreset
}

export function isEditorSession(ctx: ClientContext): boolean {
  return currentSessionPreset(ctx) === EDITOR_PRESET_ID
}

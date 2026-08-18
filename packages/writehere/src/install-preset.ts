/**
 * Copy the shipped article-editor preset into the user roster on first load.
 * Discovery only scans $DSH_HOME/.agent-presets — not node_modules.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Install the shipped preset once; never overwrite a roster directory that already has a composition. */
export function installShippedPreset(): void {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
  const src = join(packageRoot, 'presets', 'article-editor')
  if (!existsSync(join(src, 'agent.cordis.yml'))) return
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh')
  const dst = join(home, '.agent-presets', 'article-editor')
  if (existsSync(join(dst, 'agent.cordis.yml'))) return
  mkdirSync(dirname(dst), { recursive: true })
  cpSync(src, dst, { recursive: true })
}

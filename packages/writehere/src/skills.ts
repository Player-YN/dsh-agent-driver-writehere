/**
 * Load column methodology SKILL.md files into model-visible scheduler context.
 * Not a function-calling tool.
 * @module @deepseek-ai/dsh-writehere/skills
 */

import { readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const METHODOLOGY_MARKERS = ['延迟揭晓', '最小充分理解'] as const

/** Opening tag for injected methodology skill text. */
export const METHODOLOGY_OPEN = '<article-methodology>'
/** Closing tag for injected methodology skill text. */
export const METHODOLOGY_CLOSE = '</article-methodology>'

function shippedSkillsRoot(): string {
  return fileURLToPath(new URL(
    '../../../presets/article-editor/skills/',
    import.meta.url,
  ))
}

function userSkillsRoots(): string[] {
  const home = homedir()
  return [
    join(home, '.dsh', '.agent-presets', 'article-editor', 'skills'),
    join(home, '.dsh', '.agent-presets', 'xieka', 'skills'),
  ]
}

function readSkillTree(root: string): string[] {
  const chunks: string[] = []
  let names: string[]
  try {
    names = readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
  } catch {
    return chunks
  }
  for (const name of names) {
    try {
      const text = readFileSync(join(root, name, 'SKILL.md'), 'utf8').trim()
      if (text) chunks.push(`## ${name}\n\n${text}`)
    } catch {
      continue
    }
  }
  return chunks
}

/**
 * Concatenate methodology SKILL.md files from the editor preset skill trees.
 * @returns tagged markdown, or empty string when no files are readable
 */
export function methodologySkillContext(): string {
  const seen = new Set<string>()
  const parts: string[] = []
  for (const root of [shippedSkillsRoot(), ...userSkillsRoots()]) {
    for (const chunk of readSkillTree(root)) {
      if (seen.has(chunk)) continue
      seen.add(chunk)
      parts.push(chunk)
    }
  }
  if (parts.length === 0) return ''
  return [METHODOLOGY_OPEN, parts.join('\n\n'), METHODOLOGY_CLOSE].join('\n')
}

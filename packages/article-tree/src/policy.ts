/**
 * Editor vs lab identity, tool allow/deny, and one-card handoff.
 * Pure — tests import this file with no Cordis.
 */

import { win32 } from 'node:path'

export const EDITOR_ROLE = 'article-editor' as const
export const EDITOR_PRESET_ID = 'article-editor' as const
export const LAB_ROLE = 'article-lab' as const
export const LAB_PRESET_ID = 'standard' as const

export const EDITOR_PERSONA =
  '你是技术博客博主。WriteHere 调度器决定下一张卡。更新拍只改当前节点 goal。然后你回答是否原子、如何拆卡、或成稿正文。think 和 task 默认原子，再拆必须写 atomic:false。不要调用工具。一篇只做一个认知变化。选题单位是矛盾，不是术语。禁止开终端。检索与实验由标准模式工人执行。'

export const EDITOR_SYSTEM_PROMPT = [
  'You are the article editor. One article, one cognitive change. Topic unit is a contradiction, not a term.',
  'The WriteHere driver chooses the next tree node. First refine THIS node with {"goal":"..."}. Then reply with decision JSON or node prose.',
  'think and task stay atomic unless the decision sets atomic:false.',
  'Do not call tools. Do not run a shell.',
  'Web search belongs on a worker session, not this driver loop.',
].join(' ')

export const LAB_PERSONA =
  'Execute the single assigned task. Do not adopt an editorial persona. Return evidence only.'

// The editor drives through the WriteHere scheduler with `tools: []`. There is
// deliberately no editor tool allow-list here: a list would imply a
// function-calling surface the driver never exposes.

export function resolveLabPreset(preset?: string): 'standard' | 'minimal' {
  return preset === 'minimal' ? 'minimal' : 'standard'
}

export interface LabHandoff {
  role: typeof LAB_ROLE
  persona: typeof LAB_PERSONA
  nodeId: string
  brief: string
}

export function createLabHandoff(input: {
  nodeId: string
  brief: string
  editorPersona?: string
}): LabHandoff {
  const nodeId = input.nodeId.trim()
  const brief = input.brief.trim()
  if (!nodeId) throw new Error('lab handoff requires nodeId')
  if (!brief) throw new Error('lab handoff requires a one-card brief')
  if (/\n\s*#\s|全文|读者正文/.test(brief) && brief.length > 4000) {
    throw new Error('lab handoff must be one card, not a full article outline')
  }
  return {
    role: LAB_ROLE,
    persona: LAB_PERSONA,
    nodeId,
    brief,
  }
}

export function labPersonaIsNotEditor(handoff: LabHandoff): boolean {
  // Compare on a widened string, editor check first: after `=== LAB_PERSONA`
  // the value narrows back to a literal and a literal-to-literal !== is a
  // compile error (TS2367), even though this runtime guard is exactly what
  // the test helper exists to state.
  const persona: string = handoff.persona
  return handoff.role === LAB_ROLE && persona !== EDITOR_PERSONA && persona === LAB_PERSONA
}

const ARTIFACT_REL = [
  /^article\.md$/i,
  /^article\//i,
  /^articles\//i,
  /^ledger\//i,
  /^experiments\//i,
  /^runs\/[^/]+\/(article\.md|articles\/|ledger\/|experiments\/)/i,
]

export function isBoundedArticlePath(filePath: string, cwd?: string): boolean {
  const raw = filePath.trim()
  if (!raw || raw.includes('\0') || raw.includes('..')) return false
  const slash = raw.replace(/\\/g, '/')
  let rel = slash.replace(/^\.\//, '')
  if (cwd) {
    const base = cwd.replace(/\\/g, '/').replace(/\/$/, '')
    const abs = /^([a-zA-Z]:)?\//.test(slash) || win32.isAbsolute(raw)
    if (abs) {
      const lower = slash.toLowerCase()
      const prefix = base.toLowerCase()
      if (lower !== prefix && !lower.startsWith(prefix + '/')) return false
      rel = slash.slice(base.length).replace(/^\//, '')
    }
  }
  return ARTIFACT_REL.some(re => re.test(rel))
}

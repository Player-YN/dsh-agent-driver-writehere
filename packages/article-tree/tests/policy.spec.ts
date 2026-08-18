import { describe, expect, it } from 'vitest'
import * as policy from '../src/policy.ts'
import {
  EDITOR_PERSONA,
  EDITOR_SYSTEM_PROMPT,
  LAB_PERSONA,
  createLabHandoff,
  isBoundedArticlePath,
  labPersonaIsNotEditor,
  resolveLabPreset,
} from '../src/policy.ts'

describe('editor vs lab policy', () => {
  it('tells the editor the WriteHere driver owns the next card', () => {
    expect(EDITOR_PERSONA).toMatch(/WriteHere/)
    expect(EDITOR_SYSTEM_PROMPT).toMatch(/WriteHere driver/)
    expect(EDITOR_SYSTEM_PROMPT).toMatch(/Do not call tools/)
    expect(EDITOR_SYSTEM_PROMPT).not.toMatch(/Never search/)
  })

  it('builds a one-card lab handoff that does not carry the editor persona', () => {
    const handoff = createLabHandoff({
      nodeId: 'n-search',
      brief: '只要公开榜日期和有没有 4.6',
      editorPersona: EDITOR_PERSONA,
    })
    expect(handoff.persona).toBe(LAB_PERSONA)
    expect(handoff.persona).not.toBe(EDITOR_PERSONA)
    expect(labPersonaIsNotEditor(handoff)).toBe(true)
    expect(handoff.brief).toContain('公开榜')
  })

  it('rejects empty lab briefs', () => {
    expect(() => createLabHandoff({ nodeId: 'x', brief: '  ' })).toThrow(/brief/)
  })

  it('allows only article/ledger/experiment paths', () => {
    expect(isBoundedArticlePath('article.md')).toBe(true)
    expect(isBoundedArticlePath('articles/slug/article.md')).toBe(true)
    expect(isBoundedArticlePath('ledger/sources.md')).toBe(true)
    expect(isBoundedArticlePath('../secret.txt')).toBe(false)
    expect(isBoundedArticlePath('src/index.ts')).toBe(false)
  })

  it('resolves lab preset to standard unless minimal is requested', () => {
    expect(resolveLabPreset()).toBe('standard')
    expect(resolveLabPreset('minimal')).toBe('minimal')
    expect(resolveLabPreset('article-editor')).toBe('standard')
  })

  it('exposes no editor tool allow-list: the driver loop is the only tool surface', () => {
    expect('EDITOR_ALLOWED_TOOLS' in policy).toBe(false)
    expect('decideEditorTool' in policy).toBe(false)
  })
})

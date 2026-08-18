import { describe, expect, it } from 'vitest'
import { METHODOLOGY_MARKERS, methodologySkillContext } from '../src/skills.ts'

describe('methodologySkillContext', () => {
  it('loads shipped column skill wording for GetInfo injection', () => {
    const text = methodologySkillContext()
    expect(text).toContain('<article-methodology>')
    for (const marker of METHODOLOGY_MARKERS) {
      expect(text).toContain(marker)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as articleTree from '../src/index.ts'

describe('article-tree plugin', () => {
  it('registers no model-facing tools', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(articleTree)
    const names = ctx.tools.schemas().map(schema => schema.name)
    expect(names.filter(name => name.startsWith('article_'))).toEqual([])
  })
})

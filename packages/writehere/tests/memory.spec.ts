import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MEMORY_INDEX_OPEN, MEMORY_OPEN, memoryHitsText, memoryIndexText, memoryKeywords } from '../src/memory.ts'

describe('column memory', () => {
  it('indexes paths and concept names without article bodies', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-mem-'))
    await mkdir(join(cwd, 'articles', 'prior'), { recursive: true })
    await mkdir(join(cwd, 'ledger'), { recursive: true })
    await writeFile(join(cwd, 'article.md'), '# 对照稿\n\n这是一篇完整旧文，不应整篇进 index。', 'utf8')
    await writeFile(join(cwd, 'articles', 'prior', 'article.md'), '# 旧篇\n\n正文很长。', 'utf8')
    await writeFile(join(cwd, 'ledger', 'concepts.jsonl'), `${JSON.stringify({
      id: 'c1',
      name: '观察写回',
      firstArticle: 'prior',
    })}\n`, 'utf8')

    const index = await memoryIndexText(cwd)
    expect(index).toContain(MEMORY_INDEX_OPEN)
    expect(index).toContain('article.md')
    expect(index).toContain('concept:观察写回')
    expect(index).not.toContain('这是一篇完整旧文')
  })

  it('returns short keyword hits and nothing for an empty query', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-hit-'))
    await writeFile(join(cwd, 'article.md'), '观察必须写回系统状态。', 'utf8')
    const hits = await memoryHitsText(cwd, '写回')
    expect(hits).toContain(MEMORY_OPEN)
    expect(hits).toContain('article.md')
    expect(await memoryHitsText(cwd, '   ')).toBe('')
    expect(await memoryHitsText(undefined, '写回')).toBe('')
  })

  it('still hits when the query is a refined long-goal sentence, not a verbatim substring', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-longgoal-'))
    await writeFile(join(cwd, 'article.md'), '旧文的结论：模型可见的状态必须先写回上下文。', 'utf8')
    const refined = '观察为什么必须写回：写一篇系统控制栏目文，只解决一个问题——模型看到的系统状态为什么必须经写回路径进入上下文'
    const hits = await memoryHitsText(cwd, refined)
    expect(hits).toContain(MEMORY_OPEN)
    expect(hits).toContain('article.md')
  })

  it('tokenizes goals into ASCII words, short CJK segments, and 2-grams for long runs', () => {
    expect(memoryKeywords('查 DSH runtime 写回')).toEqual(['查', 'DSH', 'runtime', '写回'])
    expect(memoryKeywords('观察为什么必须写回')).toContain('写回')
    expect(memoryKeywords('观察为什么必须写回').every(keyword => keyword.length <= 4)).toBe(true)
    expect(memoryKeywords('   ')).toEqual([])
    expect(memoryKeywords('a')).toEqual([])
  })
})

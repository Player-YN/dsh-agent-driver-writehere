import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createArticleTree, decomposeNode } from '@deepseek-ai/dsh-article-tree/src/engine.ts'
import { appendWriteSection, articleSlug, draftMarkdown, markAtomic, sectionHeading } from '../src/tree.ts'

describe('tree helpers', () => {
  it('marks a node atomic', () => {
    const tree = markAtomic(createArticleTree('对照稿'), 'root')
    expect(tree.nodes.root?.atomic).toBe(true)
    expect(tree.lastOp).toBe('is-atomic')
  })

  it('slugs a topic and falls back when nothing remains', () => {
    expect(articleSlug('Hello World')).toBe('hello-world')
    expect(articleSlug('对照 4.6')).toBe('46')
    expect(articleSlug('+++')).toBe('article')
  })

  it('assembles draft markdown from leaf write nodes only', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    tree.nodes.open!.result = '叶子段'
    tree.nodes.root!.result = '父节点合成段'
    const markdown = draftMarkdown(tree)
    expect(markdown).toContain('# 对照稿')
    expect(markdown).toContain('叶子段')
    expect(markdown).not.toContain('父节点合成段')
  })

  it('appends one leaf write without rebuilding a parent compose essay', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-draft-'))
    await appendWriteSection(cwd, '对照稿', '开篇', '第一段')
    await appendWriteSection(cwd, '对照稿', '对照', '第二段')
    await appendWriteSection(cwd, '对照稿', '开篇', '第一段')
    const draft = await readFile(join(cwd, 'article.md'), 'utf8')
    expect(draft.match(/第一段/g)).toHaveLength(1)
    expect(draft).toContain('第二段')
    expect(draft).toContain('# 对照稿')
  })

  it('keeps only the lead clause of a refined goal as the section heading', () => {
    expect(sectionHeading('开篇')).toBe('开篇')
    expect(sectionHeading('对照 4.6 与 0813')).toBe('对照 4.6 与 0813')
    const refined = '观察为什么必须写回：写一篇系统控制栏目文，只解决一个问题——模型看到的系统状态为什么必须经写回路径进入上下文。'
    expect(sectionHeading(refined)).toBe('观察为什么必须写回')
    const runOn = '连'.repeat(80)
    expect(sectionHeading(runOn)).toBe(`${'连'.repeat(64)}…`)
  })

  it('uses the truncated heading when a refined long goal reaches the draft', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'writehere-heading-'))
    const refined = '观察为什么必须写回：写一篇系统控制栏目文，只解决一个问题。'
    await appendWriteSection(cwd, '观察为什么必须写回', refined, '正文段落。')
    await appendWriteSection(cwd, '观察为什么必须写回', refined, '正文段落。')
    const draft = await readFile(join(cwd, 'article.md'), 'utf8')
    expect(draft).toContain('## 观察为什么必须写回')
    expect(draft).not.toContain('## 观察为什么必须写回：')
    expect(draft.match(/正文段落。/g)).toHaveLength(1)
  })
})


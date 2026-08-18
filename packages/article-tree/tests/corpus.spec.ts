import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_CORPUS_FILE_CHARS,
  MAX_CORPUS_HITS,
  acceptCorpusRel,
  appendLedgerRecord,
  listCorpusFiles,
  searchCorpus,
  searchCorpusAny,
  searchCorpusFiles,
  toPosixRel,
  validateLedgerRecord,
} from '../src/corpus.ts'

const temps: string[] = []

afterEach(async () => {
  await Promise.all(temps.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

async function tempCwd(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'article-corpus-'))
  temps.push(dir)
  return dir
}

describe('article corpus', () => {
  it('normalizes separators and rejects unbounded relatives', () => {
    expect(toPosixRel('ledger\\concepts.jsonl')).toBe('ledger/concepts.jsonl')
    expect(acceptCorpusRel('/ws', 'article.md')).toMatch(/article\.md$/)
    expect(acceptCorpusRel('/ws', '../secret.md')).toBeNull()
    expect(acceptCorpusRel('/ws', 'src/index.ts')).toBeNull()
  })

  it('validates concept and series records and rejects bad shapes', () => {
    expect(validateLedgerRecord('concept', {
      id: 'c1',
      name: '公开榜',
      firstArticle: 'articles/a/article.md',
      namedIn: ['a'],
    }).record).toMatchObject({
      id: 'c1',
      name: '公开榜',
      firstArticle: 'articles/a/article.md',
      namedIn: ['a'],
    })
    expect(validateLedgerRecord('series', {
      from: 'a',
      to: 'b',
      kind: 'continues',
    }).path).toBe('ledger/series.jsonl')
    expect(() => validateLedgerRecord('concept', null)).toThrow(/object/)
    expect(() => validateLedgerRecord('concept', [])).toThrow(/object/)
    expect(() => validateLedgerRecord('concept', { id: ' ', name: 'n', firstArticle: 'a' })).toThrow(/id/)
    expect(() => validateLedgerRecord('concept', { id: 'c', name: '', firstArticle: 'a' })).toThrow(/name/)
    expect(() => validateLedgerRecord('concept', { id: 'c', name: 'n' })).toThrow(/firstArticle/)
    expect(() => validateLedgerRecord('series', { from: 'a', to: 'b', kind: 'other' })).toThrow(/continues/)
    expect(() => validateLedgerRecord('series', { from: '', to: 'b', kind: 'assumes' })).toThrow(/from/)
    expect(() => validateLedgerRecord('series', { from: 'a', to: '  ', kind: 'assumes' })).toThrow(/to/)
    expect(() => validateLedgerRecord('note', { id: 'x' })).toThrow(/unknown ledger kind/)
  })

  it('appends a concept and finds it via corpus search', async () => {
    const cwd = await tempCwd()
    await appendLedgerRecord(cwd, 'concept', {
      id: 'open-board',
      name: '公开榜',
      firstArticle: 'articles/compare/article.md',
    })
    await mkdir(join(cwd, 'articles', 'compare'), { recursive: true })
    await writeFile(join(cwd, 'article.md'), '# 对照稿\n公开榜只是钩子。\n', 'utf8')
    await writeFile(join(cwd, 'articles', 'compare', 'article.md'), '成稿提到公开榜。\n', 'utf8')
    await writeFile(join(cwd, 'ledger', 'notes.md'), '公开榜 should not be listed\n', 'utf8')

    const found = await searchCorpus(cwd, '公开榜')
    expect(found.hits.some(hit => hit.path === 'ledger/concepts.jsonl' && hit.snippet.includes('公开榜'))).toBe(true)
    expect(found.hits.some(hit => hit.path === 'article.md')).toBe(true)
    expect(found.hits.some(hit => hit.path === 'articles/compare/article.md')).toBe(true)
    expect(found.hits.some(hit => hit.path === 'ledger/notes.md')).toBe(false)
  })

  it('lists only bounded ledger jsonl and article markdown', async () => {
    const cwd = await tempCwd()
    await mkdir(join(cwd, 'ledger'), { recursive: true })
    await mkdir(join(cwd, 'articles', '..skip'), { recursive: true })
    await writeFile(join(cwd, 'ledger', 'concepts.jsonl'), '{}\n', 'utf8')
    await writeFile(join(cwd, 'ledger', 'skip.txt'), 'nope\n', 'utf8')
    await writeFile(join(cwd, 'articles', 'skip.txt'), 'nope\n', 'utf8')
    await writeFile(join(cwd, 'articles', '..hidden.md'), 'hidden\n', 'utf8')
    await writeFile(join(cwd, 'articles', '..skip', 'hidden.md'), 'hidden\n', 'utf8')
    // The workspace draft is listed only once it exists: the index must not
    // name files a later read cannot open.
    expect(await listCorpusFiles(cwd)).not.toContain('article.md')
    await writeFile(join(cwd, 'article.md'), '# 对照稿\n', 'utf8')
    const files = await listCorpusFiles(cwd)
    expect(files).toContain('article.md')
    expect(files).toContain('ledger/concepts.jsonl')
    expect(files).not.toContain('ledger/skip.txt')
    expect(files.some(file => file.includes('..skip'))).toBe(false)
  })

  it('scores multi-keyword hits by distinct matches and snippets the earliest one', async () => {
    const cwd = await tempCwd()
    await mkdir(join(cwd, 'articles'), { recursive: true })
    await writeFile(join(cwd, 'article.md'), '开头讲写回，后面讲观察。', 'utf8')
    await writeFile(join(cwd, 'articles', 'one.md'), '只提到观察。', 'utf8')
    const { hits } = await searchCorpusAny(cwd, ['写回', '观察', '  ', '观察'])
    expect(hits.map(hit => hit.path)).toEqual(['article.md', 'articles/one.md'])
    expect(hits[0]!.snippet).toContain('写回')
    await expect(searchCorpusAny(cwd, ['   '])).rejects.toThrow(/non-empty/)
  })

  it('skips missing files, directories named article.md, and non-matching text', async () => {
    const cwd = await tempCwd()
    await mkdir(join(cwd, 'article.md'), { recursive: true })
    await expect(searchCorpus(cwd, '   ')).rejects.toThrow(/non-empty/)
    const misses = await searchCorpusFiles(cwd, '公开榜', ['article.md', '../secret.md', 'ledger/missing.jsonl'])
    expect(misses).toEqual([])
    await rm(join(cwd, 'article.md'), { recursive: true, force: true })
    await writeFile(join(cwd, 'article.md'), 'only other words\n', 'utf8')
    expect(await searchCorpusFiles(cwd, '公开榜', ['article.md'])).toEqual([])
  })

  it('caps hits and slices oversized files', async () => {
    const cwd = await tempCwd()
    await mkdir(join(cwd, 'articles'), { recursive: true })
    const files: string[] = []
    for (let i = 0; i < MAX_CORPUS_HITS + 2; i++) {
      const rel = `articles/n${i}.md`
      await writeFile(join(cwd, rel), `hit ${i} 公开榜\n`, 'utf8')
      files.push(rel)
    }
    const capped = await searchCorpusFiles(cwd, '公开榜', files)
    expect(capped).toHaveLength(MAX_CORPUS_HITS)

    const huge = `${'x'.repeat(MAX_CORPUS_FILE_CHARS)}公开榜`
    await writeFile(join(cwd, 'article.md'), huge, 'utf8')
    const sliced = await searchCorpusFiles(cwd, '公开榜', ['article.md'])
    expect(sliced).toEqual([])
    const prefixHit = await searchCorpusFiles(cwd, 'xxx', ['article.md'])
    expect(prefixHit).toHaveLength(1)
    expect(prefixHit[0]!.snippet.length).toBeLessThanOrEqual(160 + 3)

    await writeFile(join(cwd, 'article.md'), `${'pad-'.repeat(30)}UNIQUE_TOKEN tail`, 'utf8')
    const mid = await searchCorpusFiles(cwd, 'UNIQUE_TOKEN', ['article.md'])
    expect(mid).toHaveLength(1)
    expect(mid[0]!.snippet.startsWith('UNIQUE_TOKEN')).toBe(false)
    expect(mid[0]!.snippet).toContain('UNIQUE_TOKEN')
  })

  it('appends a series line after creating ledger/', async () => {
    const cwd = await tempCwd()
    const written = await appendLedgerRecord(cwd, 'series', {
      from: 'a',
      to: 'b',
      kind: 'contradicts',
    })
    expect(written.path).toBe('ledger/series.jsonl')
    const found = await searchCorpus(cwd, 'contradicts')
    expect(found.hits).toEqual([
      expect.objectContaining({ path: 'ledger/series.jsonl', snippet: expect.stringContaining('contradicts') }),
    ])
  })
})

/**
 * Column-workspace corpus: ledger jsonl and article markdown under cwd.
 */

import { appendFile, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { isBoundedArticlePath } from './policy.ts'

export const MAX_CORPUS_HITS = 32
export const MAX_CORPUS_FILE_CHARS = 256_000
export const SERIES_KINDS = ['continues', 'contradicts', 'assumes'] as const

export interface CorpusHit {
  path: string
  snippet: string
}

export function toPosixRel(rel: string): string {
  return rel.replace(/\\/g, '/')
}

export function acceptCorpusRel(cwd: string, rel: string): string | null {
  const posix = toPosixRel(rel)
  if (!isBoundedArticlePath(posix, cwd)) return null
  return resolve(cwd, posix)
}

function asRecord(record: unknown): Record<string, unknown> {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('ledger record must be an object')
  }
  return { ...record as Record<string, unknown> }
}

function requireText(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`ledger ${key} must be a non-empty string`)
  }
  return value.trim()
}

export function validateLedgerRecord(
  kind: string,
  record: unknown,
): { path: string; record: Record<string, unknown> } {
  const raw = asRecord(record)
  if (kind === 'concept') {
    return {
      path: 'ledger/concepts.jsonl',
      record: {
        ...raw,
        id: requireText(raw, 'id'),
        name: requireText(raw, 'name'),
        firstArticle: requireText(raw, 'firstArticle'),
      },
    }
  }
  if (kind === 'series') {
    const seriesKind = requireText(raw, 'kind')
    if (!(SERIES_KINDS as readonly string[]).includes(seriesKind)) {
      throw new Error('series kind must be continues, contradicts, or assumes')
    }
    return {
      path: 'ledger/series.jsonl',
      record: {
        ...raw,
        from: requireText(raw, 'from'),
        to: requireText(raw, 'to'),
        kind: seriesKind,
      },
    }
  }
  throw new Error(`unknown ledger kind ${kind}`)
}

export async function appendLedgerRecord(
  cwd: string,
  kind: string,
  record: unknown,
): Promise<{ path: string }> {
  const validated = validateLedgerRecord(kind, record)
  const abs = resolve(cwd, validated.path)
  await mkdir(dirname(abs), { recursive: true })
  await appendFile(abs, `${JSON.stringify(validated.record)}\n`, 'utf8')
  return { path: validated.path }
}

async function readBoundedFile(abs: string): Promise<string | null> {
  try {
    const info = await stat(abs)
    if (!info.isFile()) return null
    const text = await readFile(abs, 'utf8')
    return text.length > MAX_CORPUS_FILE_CHARS ? text.slice(0, MAX_CORPUS_FILE_CHARS) : text
  } catch {
    return null
  }
}

async function listDirents(absDir: string) {
  try {
    return await readdir(absDir, { withFileTypes: true })
  } catch {
    return null
  }
}

async function isReadableFile(abs: string): Promise<boolean> {
  try {
    return (await stat(abs)).isFile()
  } catch {
    return false
  }
}

export async function listCorpusFiles(cwd: string): Promise<string[]> {
  const files: string[] = []
  if (await isReadableFile(resolve(cwd, 'article.md'))) files.push('article.md')
  const ledgerEntries = await listDirents(resolve(cwd, 'ledger'))
  if (ledgerEntries) {
    for (const entry of ledgerEntries) {
      const rel = toPosixRel(`ledger/${entry.name}`)
      if (rel.endsWith('.jsonl') && acceptCorpusRel(cwd, rel)) files.push(rel)
    }
  }
  const stack = ['articles']
  for (let relDir = stack.pop(); relDir !== undefined; relDir = stack.pop()) {
    const entries = await listDirents(resolve(cwd, relDir))
    if (!entries) continue
    for (const entry of entries) {
      const rel = toPosixRel(`${relDir}/${entry.name}`)
      if (entry.isDirectory()) {
        if (isBoundedArticlePath(rel, cwd)) stack.push(rel)
        continue
      }
      if (rel.toLowerCase().endsWith('.md') && acceptCorpusRel(cwd, rel)) files.push(rel)
    }
  }
  return files
}

export async function searchCorpusFiles(
  cwd: string,
  query: string,
  files: string[],
): Promise<CorpusHit[]> {
  const needle = query.trim()
  if (!needle) throw new Error('query must be non-empty')
  const lower = needle.toLowerCase()
  const hits: CorpusHit[] = []
  for (const rel of files) {
    if (hits.length >= MAX_CORPUS_HITS) break
    const abs = acceptCorpusRel(cwd, rel)
    if (!abs) continue
    const text = await readBoundedFile(abs)
    if (text === null) continue
    const index = text.toLowerCase().indexOf(lower)
    if (index < 0) continue
    const start = Math.max(0, index - 80)
    const end = Math.min(text.length, index + needle.length + 80)
    hits.push({ path: toPosixRel(rel), snippet: text.slice(start, end) })
  }
  return hits
}

export async function searchCorpus(cwd: string, query: string): Promise<{ hits: CorpusHit[] }> {
  return { hits: await searchCorpusFiles(cwd, query, await listCorpusFiles(cwd)) }
}

/**
 * Multi-keyword corpus scan: each file is read once, scored by how many
 * distinct keywords it contains, and snippeted around its earliest match.
 * Files matching more keywords sort first.
 */
export async function searchCorpusAny(cwd: string, keywords: string[]): Promise<{ hits: CorpusHit[] }> {
  const needles = [...new Set(keywords.map(keyword => keyword.trim().toLowerCase()).filter(Boolean))]
  if (needles.length === 0) throw new Error('keywords must be non-empty')
  const scored: Array<CorpusHit & { score: number }> = []
  for (const rel of await listCorpusFiles(cwd)) {
    const abs = acceptCorpusRel(cwd, rel)
    if (!abs) continue
    const text = await readBoundedFile(abs)
    if (text === null) continue
    const lower = text.toLowerCase()
    let firstIndex = -1
    let firstLength = 0
    let score = 0
    for (const needle of needles) {
      const index = lower.indexOf(needle)
      if (index < 0) continue
      score += 1
      if (firstIndex < 0 || index < firstIndex) {
        firstIndex = index
        firstLength = needle.length
      }
    }
    if (firstIndex < 0) continue
    const start = Math.max(0, firstIndex - 80)
    const end = Math.min(text.length, firstIndex + firstLength + 80)
    scored.push({ path: toPosixRel(rel), snippet: text.slice(start, end), score })
  }
  scored.sort((a, b) => b.score - a.score)
  return { hits: scored.slice(0, MAX_CORPUS_HITS).map(({ path, snippet }) => ({ path, snippet })) }
}

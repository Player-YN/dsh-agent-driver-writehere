/**
 * Progressive-disclosure column memory. Index and hits stay outside GetInfo.
 * @module @deepseek-ai/dsh-writehere/memory
 */

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { listCorpusFiles, searchCorpusAny } from '@deepseek-ai/dsh-article-tree/src/corpus.ts'

/** Opening tag around the once-per-session path index. */
export const MEMORY_INDEX_OPEN = '<article-memory-index>'
/** Closing tag around the once-per-session path index. */
export const MEMORY_INDEX_CLOSE = '</article-memory-index>'
/** Opening tag around this tick's keyword hits. */
export const MEMORY_OPEN = '<article-memory>'
/** Closing tag around this tick's keyword hits. */
export const MEMORY_CLOSE = '</article-memory>'

const MAX_INDEX_PATHS = 16
const MAX_CONCEPTS = 12
const MAX_HITS = 4
const MAX_SNIPPET = 160
const MAX_KEYWORDS = 12
const MAX_QUERY_CHARS = 200
const ASCII_SEGMENT = /^[\x20-\x7f]+$/

/**
 * Split a node goal into short searchable keywords. A refined goal is a long
 * planning sentence that never recurs verbatim in the corpus, so whole-string
 * substring search finds nothing; keywords keep recall.
 * ASCII words pass through; CJK segments up to 4 chars pass whole, longer
 * ones yield overlapping 2-grams (the standard CJK substring tokenization).
 */
export function memoryKeywords(query: string): string[] {
  const segments = query.trim().slice(0, MAX_QUERY_CHARS).split(/[\s\p{P}\p{S}]+/u).filter(Boolean)
  const keywords: string[] = []
  const push = (keyword: string): void => {
    if (keywords.length < MAX_KEYWORDS && !keywords.includes(keyword)) keywords.push(keyword)
  }
  for (const segment of segments) {
    if (keywords.length >= MAX_KEYWORDS) break
    if (ASCII_SEGMENT.test(segment)) {
      if (segment.length >= 2) push(segment)
      continue
    }
    if (segment.length <= 4) {
      push(segment)
      continue
    }
    for (let i = 0; i + 2 <= segment.length && keywords.length < MAX_KEYWORDS; i += 1) {
      push(segment.slice(i, i + 2))
    }
  }
  return keywords
}

async function conceptNames(cwd: string): Promise<string[]> {
  try {
    const text = await readFile(resolve(cwd, 'ledger', 'concepts.jsonl'), 'utf8')
    const names: string[] = []
    for (const line of text.split('\n')) {
      if (!line.trim() || names.length >= MAX_CONCEPTS) break
      try {
        const record = JSON.parse(line) as { name?: unknown }
        if (typeof record.name === 'string' && record.name.trim()) names.push(record.name.trim())
      } catch {
        continue
      }
    }
    return names
  } catch {
    return []
  }
}

/**
 * Path-and-name index only. No article bodies.
 */
export async function memoryIndexText(cwd: string | undefined): Promise<string> {
  if (!cwd) return ''
  const [files, concepts] = await Promise.all([listCorpusFiles(cwd), conceptNames(cwd)])
  const paths = files.slice(0, MAX_INDEX_PATHS)
  if (paths.length === 0 && concepts.length === 0) return ''
  const lines = [
    MEMORY_INDEX_OPEN,
    'Prior column artifacts (titles/paths only). Ask a later tick for a hit snippet; do not assume unread bodies.',
    ...paths.map(path => `- ${path}`),
    ...concepts.map(name => `- concept:${name}`),
    MEMORY_INDEX_CLOSE,
  ]
  return lines.join('\n')
}

/**
 * Short keyword hits for the current node goal. Not a full-article dump.
 * The goal is tokenized ({@link memoryKeywords}); files matching more
 * keywords rank first.
 */
export async function memoryHitsText(cwd: string | undefined, query: string): Promise<string> {
  if (!cwd) return ''
  const keywords = memoryKeywords(query)
  if (keywords.length === 0) return ''
  try {
    const { hits } = await searchCorpusAny(cwd, keywords)
    if (hits.length === 0) return ''
    const lines = hits.slice(0, MAX_HITS).map((hit) => {
      const snippet = hit.snippet.replace(/\s+/g, ' ').trim().slice(0, MAX_SNIPPET)
      return `- ${hit.path}: ${snippet}`
    })
    return [MEMORY_OPEN, ...lines, MEMORY_CLOSE].join('\n')
  } catch {
    return ''
  }
}

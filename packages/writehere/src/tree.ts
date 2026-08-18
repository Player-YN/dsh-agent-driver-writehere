/**
 * Session-backed article tree load/save and workspace draft IO.
 * @module @deepseek-ai/dsh-writehere/tree
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { cloneTree, createArticleTree, type ArticleTree } from '@deepseek-ai/dsh-article-tree/src/engine.ts'
import type { Session } from '@deepseek-ai/dsh-session'

/** Last `article/tree` snapshot in the session, or null before the first save. */
export function loadTree(session: Session): ArticleTree | null {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i]
    if ((event?.type as string) === 'article/tree') {
      return (event as { data: { tree: ArticleTree } }).data.tree
    }
  }
  return null
}

/** Persist a whole-tree snapshot (`article/tree` is declared by dsh-article-tree). */
export function saveTree(session: Session, tree: ArticleTree): void {
  (session as unknown as { append(type: string, data: unknown): void }).append('article/tree', { tree })
}

/** Create the root write tree from the first user topic when none exists. */
export function ensureTree(session: Session, topic: string): ArticleTree {
  const existing = loadTree(session)
  if (existing) return existing
  return startTree(session, topic)
}

/** Persist a fresh root tree, replacing a settled snapshot. */
export function startTree(session: Session, topic: string): ArticleTree {
  const tree = createArticleTree(topic)
  saveTree(session, tree)
  return tree
}

/** Mark a node atomic without decomposing it. */
export function markAtomic(tree: ArticleTree, nodeId: string): ArticleTree {
  const next = cloneTree(tree)
  const node = next.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  node.atomic = true
  next.lastOp = 'is-atomic'
  next.selectedId = nodeId
  return next
}

const MAX_HEADING_CHARS = 64

/**
 * Draft `##` heading for one write node. Update(v*, K) refines goals into
 * long planning sentences; a heading keeps only the lead clause — cut at the
 * first sentence end or colon (the refined goal's elaboration marker) and
 * hard-capped. ASCII `.` is not a cut point so "4.6" survives.
 */
export function sectionHeading(goal: string): string {
  const flat = goal.trim().replace(/\s+/g, ' ')
  const lead = flat.split(/[。！？!?\n：:]/u)[0]?.trim() || flat
  return lead.length > MAX_HEADING_CHARS ? `${lead.slice(0, MAX_HEADING_CHARS)}…` : lead
}

/** Workspace folder name derived from the article topic. */
export function articleSlug(topic: string): string {
  const slug = topic
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
    .slice(0, 48)
  return slug || 'article'
}

/** Read `articles/<slug>/article.md` or `article.md` when the workspace exists. */
export async function readDraft(cwd: string | undefined, topic: string): Promise<string> {
  if (!cwd) return ''
  const slug = articleSlug(topic)
  const candidates = [resolve(cwd, 'articles', slug, 'article.md'), resolve(cwd, 'article.md')]
  for (const path of candidates) {
    try {
      return await readFile(path, 'utf8')
    } catch {
      continue
    }
  }
  return ''
}

/**
 * Write the current draft under the session cwd. File errors are swallowed so
 * a missing filesystem never blocks a tree commit.
 */
export async function writeDraft(cwd: string | undefined, topic: string, markdown: string): Promise<void> {
  if (!cwd) return
  const slug = articleSlug(topic)
  const dir = resolve(cwd, 'articles', slug)
  const body = markdown.startsWith('#') ? markdown : `# ${topic}\n\n${markdown}`
  try {
    await mkdir(dir, { recursive: true })
    await writeFile(resolve(dir, 'article.md'), body, 'utf8')
    await writeFile(resolve(cwd, 'article.md'), body, 'utf8')
  } catch {
    // Workspace may be missing or read-only; the tree commit still stands.
  }
}

/** Assemble committed write-node results into one markdown draft. */
export function draftMarkdown(tree: ArticleTree): string {
  const sections = tree.order.flatMap((id) => {
    const node = tree.nodes[id]
    if (!node || node.type !== 'write' || !node.result || node.children.length > 0) return []
    return [`## ${sectionHeading(node.goal)}\n\n${node.result}`]
  })
  return [`# ${tree.topic}`, '', ...sections].join('\n')
}

/** Append one leaf write to the workspace article. Does not rebuild parent compose. */
export async function appendWriteSection(
  cwd: string | undefined,
  topic: string,
  goal: string,
  result: string,
): Promise<void> {
  if (!cwd) return
  const existing = await readDraft(cwd, topic)
  const header = existing.trim() ? existing.trimEnd() : `# ${topic}`
  const section = `## ${sectionHeading(goal)}\n\n${result.trim()}`
  if (existing.includes(section)) return
  await writeDraft(cwd, topic, `${header}\n\n${section}\n`)
}

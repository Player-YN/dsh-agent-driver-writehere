import type { Session } from '@deepseek-ai/dsh-session'
import { createArticleTree, type ArticleTree } from './engine.ts'
import type {} from './types.ts'

export function loadTree(session: Session): ArticleTree | null {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i]
    if (event?.type === 'article/tree') return event.data.tree
  }
  return null
}

export function saveTree(session: Session, tree: ArticleTree): void {
  session.append('article/tree', { tree })
}

export function loadOrCreate(session: Session, topic: string): ArticleTree {
  return loadTree(session) ?? createArticleTree(topic)
}

export function loadLabChildId(session: Session, nodeId: string): string | null {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i]
    if (event?.type === 'article/lab' && event.data.nodeId === nodeId) return event.data.childId
  }
  return null
}

export function saveLabChild(session: Session, nodeId: string, childId: string): void {
  session.append('article/lab', { nodeId, childId })
}

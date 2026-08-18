/**
 * Session event + projection key for the article tree.
 * @module @deepseek-ai/dsh-article-tree/types
 */

// Load the augmentation targets so their module names resolve wherever this
// file is type-checked (TS2664 otherwise, e.g. in the root aggregate program).
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-session-projection/types'
import type { ArticleTree } from './engine.ts'

export type { ArticleNode, ArticleNodeStatus, ArticleNodeType, ArticleTree } from './engine.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /** Whole-tree snapshot after an editor move. Last write wins. */
    'article/tree': { tree: ArticleTree }
    /** Continuable lab child for one tree node. Last write wins per nodeId. */
    'article/lab': { nodeId: string; childId: string }
  }
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Current article tree, or null before the first editor move. */
    articleTree: ArticleTree | null
  }
}

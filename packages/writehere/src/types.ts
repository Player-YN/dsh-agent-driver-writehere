/**
 * Session events owned by the WriteHere driver.
 * @module @deepseek-ai/dsh-writehere/types
 */

import type { ArticleNodeInfo } from '@deepseek-ai/dsh-article-tree/src/getinfo.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * Records which Agent constructor this session constructed. Appended once
     * per WriteHere session so replay can prove the driver was not ReactLoop.
     */
    'agent/driver': { id: 'writehere' }
    /**
     * GetInfo snapshot taken immediately before a scheduler LLM call.
     */
    'article/get-info': { info: ArticleNodeInfo }
    /** Paper Update(v*, K) of the selected node. */
    'article/update': { nodeId: string; goal: string }
  }
}

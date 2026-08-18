/**
 * Article-tree projection and library. The WriteHere driver owns scheduling;
 * this plugin does not register model-facing tools.
 * @module @deepseek-ai/dsh-article-tree
 */

import type { Context } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
// Carries the `ctx.sessionProjections` Context merge for the apply() below.
import type {} from '@deepseek-ai/dsh-session-projection'
import type { ArticleTree } from './engine.ts'
import type {} from './types.ts'

export type * from './types.ts'
export {
  allChildrenDone,
  cloneTree,
  commitNode,
  createArticleTree,
  decomposeNode,
  isAtomicFlag,
  layoutHorizontalTree,
  markRunning,
  isLabType,
  pickReadyNode,
  setGoal,
  reviseParent,
} from './engine.ts'
export { appendLedgerRecord, searchCorpus, searchCorpusAny, validateLedgerRecord } from './corpus.ts'
export { getExecuteInfo, getNodeInfo, getPlannerInfo, MAX_ANCESTOR_DEPTH } from './getinfo.ts'
export type { ArticleNodeInfo, ArticleNodeInfoCorpus, ArticleNodeInfoRef, GraphNodeRef } from './getinfo.ts'
export {
  EDITOR_PERSONA,
  EDITOR_SYSTEM_PROMPT,
  LAB_PERSONA,
  createLabHandoff,
  isBoundedArticlePath,
  labPersonaIsNotEditor,
  resolveLabPreset,
} from './policy.ts'
export { loadLabChildId, loadOrCreate, loadTree, saveLabChild, saveTree } from './session.ts'

export const name = 'article-tree'
export const inject = [] as const

const treeSchema: ZodType<ArticleTree | null> = zod.any() as ZodType<ArticleTree | null>

/** Register the sidebar projection only. No tools, no deny hook. */
export function apply(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register<'articleTree', ArticleTree | null>({
      key: 'articleTree',
      schema: treeSchema,
      init: () => null,
      apply: (state, event) => {
        if (event.type === 'article/tree') return event.data.tree
        return state
      },
      view: state => state,
      stateVersion: 1,
    })
  })
}

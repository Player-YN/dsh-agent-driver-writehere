/**
 * Pure GetInfo for one article-tree node.
 * Execute K = draft + depth-capped ancestors + deps.
 * Planner K adds global structural G. Ledger is not part of this envelope.
 */

import type { ArticleNode, ArticleNodeStatus, ArticleNodeType, ArticleTree } from './engine.ts'

export const MAX_ANCESTOR_DEPTH = 4

/** Workspace draft the driver already retrieved for this step. */
export interface ArticleNodeInfoCorpus {
  draft: string
}

/** Ancestor or dependency snapshot used as model-visible context. */
export interface ArticleNodeInfoRef {
  id: string
  goal: string
  result: string | null
}

/** Paper planner G: one node's structural fields. */
export interface GraphNodeRef {
  id: string
  type: ArticleNodeType
  goal: string
  deps: string[]
  status: ArticleNodeStatus
}

/** GetInfo payload. `graph` is planner-only. */
export interface ArticleNodeInfo {
  node: ArticleNode
  ancestors: ArticleNodeInfoRef[]
  deps: ArticleNodeInfoRef[]
  draft: string
  graph?: GraphNodeRef[]
}

function collectAncestors(tree: ArticleTree, node: ArticleNode, maxDepth: number): ArticleNodeInfoRef[] {
  const ancestors: ArticleNodeInfoRef[] = []
  const seen = new Set<string>()
  let parentId = node.parentId
  while (parentId && ancestors.length < maxDepth) {
    if (parentId === node.id || seen.has(parentId)) break
    seen.add(parentId)
    const parent = tree.nodes[parentId]
    if (!parent) break
    ancestors.push({ id: parent.id, goal: parent.goal, result: parent.result })
    parentId = parent.parentId
  }
  ancestors.reverse()
  return ancestors
}

function collectDeps(tree: ArticleTree, node: ArticleNode): ArticleNodeInfoRef[] {
  return (node.dependsOn ?? []).map((id): ArticleNodeInfoRef => {
    const dep = tree.nodes[id]
    if (!dep) return { id, goal: '', result: null }
    return { id: dep.id, goal: dep.goal, result: dep.result }
  })
}

function collectGraph(tree: ArticleTree): GraphNodeRef[] {
  return tree.order.flatMap((id) => {
    const node = tree.nodes[id]
    if (!node) return []
    return [{
      id: node.id,
      type: node.type,
      goal: node.goal,
      deps: [...(node.dependsOn ?? [])],
      status: node.status,
    }]
  })
}

/** Execute GetInfo: draft, depth-capped ancestors, dependency results. */
export function getExecuteInfo(
  tree: ArticleTree,
  nodeId: string,
  corpus: ArticleNodeInfoCorpus,
  ancestorDepth = MAX_ANCESTOR_DEPTH,
): ArticleNodeInfo {
  const node = tree.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  return {
    node,
    ancestors: collectAncestors(tree, node, ancestorDepth),
    deps: collectDeps(tree, node),
    draft: corpus.draft,
  }
}

/** Planner GetInfo: execute K plus global structural G. */
export function getPlannerInfo(
  tree: ArticleTree,
  nodeId: string,
  corpus: ArticleNodeInfoCorpus,
  ancestorDepth = MAX_ANCESTOR_DEPTH,
): ArticleNodeInfo {
  const info = getExecuteInfo(tree, nodeId, corpus, ancestorDepth)
  return { ...info, graph: collectGraph(tree) }
}

/** @deprecated prefer getExecuteInfo / getPlannerInfo */
export function getNodeInfo(
  tree: ArticleTree,
  nodeId: string,
  corpus: ArticleNodeInfoCorpus & { ledgerHits?: string[] },
): ArticleNodeInfo {
  return getExecuteInfo(tree, nodeId, { draft: corpus.draft })
}

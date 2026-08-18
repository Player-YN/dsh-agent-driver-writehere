/**
 * WriteHERE article-tree engine: decompose, pick, commit, setGoal.
 * Pure functions — no Cordis and no LLM calls.
 * `reviseParent` is kept as a non-paper helper and is not Algorithm 1 Update.
 */

export type ArticleNodeType = 'task' | 'search' | 'think' | 'write'

/** True when the node is a lab card dispatched to a ReAct worker. */
export function isLabType(type: ArticleNodeType): boolean {
  return type === 'task' || type === 'search'
}
export type ArticleNodeStatus = 'ready' | 'blocked' | 'waiting' | 'done' | 'running' | 'needs-update'

export interface ArticleNode {
  id: string
  parentId: string | null
  type: ArticleNodeType
  goal: string
  status: ArticleNodeStatus
  atomic: boolean
  result: string | null
  children: string[]
  /** Node ids that must be `done` before this node can become ready. */
  dependsOn: string[]
  /** Optional composition length budget (paper write children). */
  length?: number
}

export interface ArticleTree {
  topic: string
  nodes: Record<string, ArticleNode>
  order: string[]
  lastOp: string | null
  selectedId: string | null
}

export interface DecomposeChild {
  id?: string
  type: ArticleNodeType
  goal: string
  atomic?: boolean
  dependsOn?: string[]
  length?: number
}

export function createArticleTree(topic: string): ArticleTree {
  const trimmed = topic.trim()
  if (!trimmed) throw new Error('topic must be non-empty')
  return {
    topic: trimmed,
    nodes: {
      root: {
        id: 'root',
        parentId: null,
        type: 'write',
        goal: trimmed,
        status: 'ready',
        atomic: false,
        result: null,
        children: [],
        dependsOn: [],
      },
    },
    order: ['root'],
    lastOp: 'create',
    selectedId: 'root',
  }
}

export function cloneTree(tree: ArticleTree): ArticleTree {
  return JSON.parse(JSON.stringify(tree)) as ArticleTree
}

export function pickReadyNode(tree: ArticleTree): string | null {
  let best: string | null = null
  let bestDepth = Infinity
  for (const id of tree.order) {
    const node = tree.nodes[id]
    if (!node || (node.status !== 'ready' && node.status !== 'needs-update')) continue
    const depth = nodeDepth(tree, id)
    if (depth < bestDepth) {
      best = id
      bestDepth = depth
    }
  }
  return best
}

/**
 * True when `decidedAtomic` is true or the node is already atomic.
 * The engine does not call an LLM.
 * @param node - stored node
 * @param decidedAtomic - optional runtime IsAtomic answer
 * @returns whether the node should execute as atomic
 */
export function isAtomicFlag(node: ArticleNode, decidedAtomic?: boolean): boolean {
  return decidedAtomic === true || node.atomic === true
}

export function allChildrenDone(tree: ArticleTree, id: string): boolean {
  const node = tree.nodes[id]
  if (!node || node.children.length === 0) return true
  return node.children.every(cid => tree.nodes[cid]?.status === 'done')
}

export function decomposeNode(
  tree: ArticleTree,
  nodeId: string,
  children: DecomposeChild[],
): ArticleTree {
  const next = cloneTree(tree)
  const node = next.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  if (node.status === 'done') throw new Error(`cannot decompose a done node ${nodeId}`)
  if (node.atomic) throw new Error(`cannot decompose atomic node ${nodeId}`)
  if (children.length < 1) throw new Error('decompose requires at least one child')
  const resolvedIds = children.map((child, index) => child.id?.trim() || `${nodeId}-c${index + 1}`)
  // Numeric dependsOn entries are sibling indexes for every parent type, not
  // only write parents.
  children = children.map((child) => {
    if (child.dependsOn === undefined) return child
    const dependsOn = child.dependsOn.map((dep) => {
      if (/^\d+$/.test(dep)) {
        const index = Number(dep)
        return resolvedIds[index] ?? dep
      }
      return dep
    })
    return { ...child, dependsOn }
  })
  if (node.type === 'write') {
    if (!children.some(child => child.type === 'write')) {
      throw new Error('write decompose requires at least one write child')
    }
    const lastWriteIndex = children.reduce((acc, child, index) => child.type === 'write' ? index : acc, -1)
    const writeIds = resolvedIds.filter((_, index) => children[index]?.type === 'write')
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the some() guard proved a write child exists
    const lastWriteId = resolvedIds[lastWriteIndex]!
    for (const child of children.slice(lastWriteIndex + 1)) {
      if (!isLabType(child.type)) {
        throw new Error('write decompose requires the last child to be write, or a trailing task that depends on a write')
      }
    }
    children = children.map((child, index) => {
      if (index <= lastWriteIndex || !isLabType(child.type)) return child
      const deps = child.dependsOn ?? []
      if (deps.some(dep => writeIds.includes(dep))) return child
      return { ...child, dependsOn: [...deps, lastWriteId] }
    })
  }
  const ids: string[] = resolvedIds
  children = chainSiblingDependsOn(children, ids, 'write')
  children = chainSiblingDependsOn(children, ids, 'think')
  const newIds = new Set<string>()
  for (const id of ids) {
    if (next.nodes[id] || newIds.has(id)) throw new Error(`node id already exists: ${id}`)
    newIds.add(id)
  }
  children.forEach((child, index) => {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- ids was mapped from this same children array, so every index is present
    const id = ids[index]!
    const goal = child.goal.trim()
    if (!goal) throw new Error('child goal must be non-empty')
    const dependsOn = (child.dependsOn ? [...child.dependsOn] : []).filter((dep) => {
      if (dep === id) throw new Error(`node ${id} cannot depend on itself`)
      return Boolean(next.nodes[dep] || newIds.has(dep))
    })
    const defaultAtom = child.type === 'think' || isLabType(child.type)
    next.nodes[id] = {
      id,
      parentId: nodeId,
      type: child.type,
      goal,
      status: 'blocked',
      atomic: child.atomic === true || (child.atomic !== false && defaultAtom),
      result: null,
      children: [],
      dependsOn,
      ...child.length !== undefined ? { length: child.length } : {},
    }
    next.order.push(id)
  })
  node.children = node.children.concat(ids)
  node.status = 'waiting'
  recomputeReadiness(next)
  next.lastOp = 'decompose'
  next.selectedId = nodeId
  return next
}

export function commitNode(tree: ArticleTree, nodeId: string, result: string): ArticleTree {
  const next = cloneTree(tree)
  const node = next.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  if (node.status !== 'ready' && node.status !== 'running') {
    throw new Error(`node ${nodeId} is ${node.status}, not committable`)
  }
  const text = result.trim()
  if (!text) throw new Error('commit result must be non-empty')
  if (node.type === 'write' && !node.atomic && node.children.length > 0 && !allChildrenDone(next, nodeId)) {
    throw new Error('non-atomic write node commits only after children are done')
  }
  node.status = 'done'
  node.result = text
  recomputeReadiness(next)
  next.lastOp = 'commit'
  next.selectedId = nodeId
  return next
}

function nodeDepth(tree: ArticleTree, id: string): number {
  let depth = 0
  let current = tree.nodes[id]
  const seen = new Set<string>()
  while (current?.parentId) {
    if (seen.has(current.id)) break
    seen.add(current.id)
    depth += 1
    current = tree.nodes[current.parentId]
  }
  return depth
}

function dependsOnDone(tree: ArticleTree, node: ArticleNode): boolean {
  return (node.dependsOn ?? []).every(id => tree.nodes[id]?.status === 'done')
}

function parentAllowsReady(tree: ArticleTree, node: ArticleNode): boolean {
  if (node.parentId === null) return true
  return tree.nodes[node.parentId]?.status === 'waiting'
}

function recomputeReadiness(tree: ArticleTree): void {
  for (const id of tree.order) {
    const node = tree.nodes[id]
    if (!node) continue
    if (node.status === 'done' || node.status === 'running') continue
    const canReady = dependsOnDone(tree, node) && parentAllowsReady(tree, node)
    if (node.status === 'waiting') {
      if (allChildrenDone(tree, id) && canReady) node.status = 'ready'
      continue
    }
    if (!canReady) {
      node.status = 'blocked'
      continue
    }
    if (node.status === 'blocked' && (node.dependsOn ?? []).length > 0) {
      node.status = 'needs-update'
      continue
    }
    if (node.status !== 'needs-update') node.status = 'ready'
  }
}

/**
 * Paper Update(v*, K): rewrite this node's goal only.
 * Not parent-goal rewrite.
 */
export function setGoal(tree: ArticleTree, nodeId: string, goal: string): ArticleTree {
  const next = cloneTree(tree)
  const node = next.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  const text = goal.trim()
  if (!text) throw new Error('updated goal must be non-empty')
  node.goal = text
  if (node.status === 'needs-update') node.status = 'ready'
  next.lastOp = 'update'
  next.selectedId = nodeId
  return next
}

function chainSiblingDependsOn(
  children: DecomposeChild[],
  ids: string[],
  type: ArticleNodeType,
): DecomposeChild[] {
  let previous: string | null = null
  return children.map((child, index) => {
    if (child.type !== type) return child
    if (previous && (child.dependsOn === undefined || child.dependsOn.length === 0)) {
      child = { ...child, dependsOn: [previous] }
    }
    // oxlint-disable-next-line typescript/no-non-null-assertion -- ids was mapped from this same children array, so every index is present
    previous = ids[index]!
    return child
  })
}

/**
 * Non-paper helper. Algorithm 1 Update rewrites the selected node, not its parent.
 * Kept so existing tests can name the leftover API.
 */
export function reviseParent(tree: ArticleTree, childId: string, newGoal: string): ArticleTree {
  const next = cloneTree(tree)
  const child = next.nodes[childId]
  if (!child) throw new Error(`unknown node ${childId}`)
  if (!child.parentId) throw new Error('root has no parent to revise')
  const parent = next.nodes[child.parentId]
  if (!parent) throw new Error(`missing parent ${child.parentId}`)
  const goal = newGoal.trim()
  if (!goal) throw new Error('revised goal must be non-empty')
  parent.goal = goal
  next.lastOp = 'revise-parent'
  next.selectedId = parent.id
  return next
}

export function markRunning(tree: ArticleTree, nodeId: string): ArticleTree {
  const next = cloneTree(tree)
  const node = next.nodes[nodeId]
  if (!node) throw new Error(`unknown node ${nodeId}`)
  if (node.status !== 'ready') throw new Error(`node ${nodeId} is not ready`)
  node.status = 'running'
  next.lastOp = 'dispatch'
  next.selectedId = nodeId
  return next
}

export interface TreeLayoutPoint {
  x: number
  y: number
}

export interface TreeLayout {
  positions: Record<string, TreeLayoutPoint>
  width: number
  height: number
}

const NODE_W = 176
const XGAP = 214

function leafCount(tree: ArticleTree, id: string): number {
  const node = tree.nodes[id]
  if (!node || node.children.length === 0) return 1
  return node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0)
}

/** Left-to-right layout: depth grows X, siblings split Y. */
export function layoutHorizontalTree(tree: ArticleTree): TreeLayout {
  const positions: Record<string, TreeLayoutPoint> = {}
  const leaves = leafCount(tree, 'root')
  const height = Math.max(220, leaves * 88 + 24)

  const place = (id: string, depth: number, y0: number, y1: number): void => {
    const node = tree.nodes[id]
    if (!node) return
    positions[id] = { x: 16 + NODE_W / 2 + depth * XGAP, y: (y0 + y1) / 2 }
    if (node.children.length === 0) return
    const total = node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0)
    let cursor = y0
    for (const cid of node.children) {
      const span = ((y1 - y0) * leafCount(tree, cid)) / total
      place(cid, depth + 1, cursor, cursor + span)
      cursor += span
    }
  }

  place('root', 0, 16, height - 16)
  let maxX = 0
  for (const point of Object.values(positions)) {
    if (point.x > maxX) maxX = point.x
  }
  return { positions, width: maxX + NODE_W / 2 + 20, height }
}

/** Client copy of the host horizontal layout (no host-package import). */

export interface ViewNode {
  id: string
  type: 'task' | 'search' | 'think' | 'write'
  goal: string
  status: string
  children: string[]
  /** Host DAG edges. Omitted field is none. */
  dependsOn?: string[]
}

export interface ViewTree {
  topic: string
  nodes: Record<string, ViewNode>
}

export interface ViewPoint {
  x: number
  y: number
}

export type ViewEdgeKind = 'child' | 'depends'

export interface ViewEdge {
  from: string
  to: string
  kind: ViewEdgeKind
}

const NODE_W = 176
const XGAP = 214
const GRAPH_NODE_W = 168

/** Card size used by the canvas (center-based positions). */
export const CANVAS_NODE_W = 200
export const CANVAS_NODE_H = 88
const CANVAS_XPAD = 32
const CANVAS_YGAP = 156

function leafCount(tree: ViewTree, id: string): number {
  const node = tree.nodes[id]
  if (!node || node.children.length === 0) return 1
  return node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0)
}

/** Parent-child only. `dependsOn` must not change X, or ready siblings look serial. */
export function layoutHorizontalTree(tree: ViewTree) {
  const positions: Record<string, ViewPoint> = {}
  const height = Math.max(220, leafCount(tree, 'root') * 88 + 24)
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

/**
 * Top-down outline: depth grows Y, siblings fan in X.
 * Parent-child only — `dependsOn` never moves a node.
 */
export function layoutVerticalTree(tree: ViewTree) {
  const positions: Record<string, ViewPoint> = {}
  const width = Math.max(560, leafCount(tree, 'root') * (CANVAS_NODE_W + CANVAS_XPAD) + 48)
  const place = (id: string, depth: number, x0: number, x1: number): void => {
    const node = tree.nodes[id]
    if (!node) return
    positions[id] = { x: (x0 + x1) / 2, y: 56 + depth * CANVAS_YGAP }
    if (node.children.length === 0) return
    const total = node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0)
    let cursor = x0
    for (const cid of node.children) {
      const span = ((x1 - x0) * leafCount(tree, cid)) / total
      place(cid, depth + 1, cursor, cursor + span)
      cursor += span
    }
  }
  place('root', 0, 24, width - 24)
  let maxY = 0
  for (const point of Object.values(positions)) {
    if (point.y > maxY) maxY = point.y
  }
  return { positions, width, height: maxY + CANVAS_NODE_H / 2 + 48 }
}

export function nodeDependsOn(node: ViewNode): string[] {
  return node.dependsOn ?? []
}

export function formatWaitsOn(ids: readonly string[]): string | undefined {
  if (ids.length === 0) return undefined
  return `waits on: ${ids.join(', ')}`
}

export function clipViewText(text: string, n: number): string {
  return text.length <= n ? text : `${text.slice(0, n - 1)}…`
}

export function viewEdges(tree: ViewTree): ViewEdge[] {
  const edges: ViewEdge[] = []
  const childKeys = new Set<string>()
  for (const node of Object.values(tree.nodes)) {
    for (const cid of node.children) {
      if (!tree.nodes[cid]) continue
      childKeys.add(`${node.id}\0${cid}`)
      edges.push({ from: node.id, to: cid, kind: 'child' })
    }
  }
  for (const node of Object.values(tree.nodes)) {
    for (const dep of nodeDependsOn(node)) {
      if (!tree.nodes[dep]) continue
      if (childKeys.has(`${dep}\0${node.id}`)) continue
      edges.push({ from: dep, to: node.id, kind: 'depends' })
    }
  }
  return edges
}

export function childLinkPath(from: ViewPoint, to: ViewPoint, nodeW = GRAPH_NODE_W): string {
  const x1 = from.x + nodeW / 2
  const y1 = from.y
  const x2 = to.x - nodeW / 2
  const y2 = to.y
  const mid = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`
}

/** Parent bottom-center to child top-center. Stretches when either card moves. */
export function childLinkPathDown(
  from: ViewPoint,
  to: ViewPoint,
  nodeH = CANVAS_NODE_H,
): string {
  const x1 = from.x
  const y1 = from.y + nodeH / 2
  const x2 = to.x
  const y2 = to.y - nodeH / 2
  const mid = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`
}

export function dependsLinkPath(from: ViewPoint, to: ViewPoint, nodeW = GRAPH_NODE_W): string {
  if (Math.abs(to.x - from.x) < 8) {
    const x1 = from.x + nodeW / 2
    const x2 = to.x + nodeW / 2
    const bow = from.x + nodeW / 2 + 22
    return `M ${x1} ${from.y} C ${bow} ${from.y} ${bow} ${to.y} ${x2} ${to.y}`
  }
  if (to.x >= from.x) return childLinkPath(from, to, nodeW)
  const x1 = from.x - nodeW / 2
  const x2 = to.x + nodeW / 2
  const mid = (x1 + x2) / 2
  return `M ${x1} ${from.y} C ${mid} ${from.y} ${mid} ${to.y} ${x2} ${to.y}`
}

/** Card-tree window and canvas — process-local, not persisted. */

import {
  layoutVerticalTree,
  type ViewPoint,
  type ViewTree,
} from './layout.ts'

const listeners = new Set<() => void>()

let open = false
let epoch = 0
let sessionKey = ''
let windowOffset: ViewPoint | null = null
let pan: ViewPoint = { x: 48, y: 36 }
let zoom = 1
let nodePos: Record<string, ViewPoint> = {}

function notify(): void {
  epoch += 1
  for (const listener of listeners) listener()
}

export function getCanvasEpoch(): number {
  return epoch
}

export function subscribeArticleTreeOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function isArticleTreeOpen(): boolean {
  return open
}

export function setArticleTreeOpen(next: boolean): void {
  if (open === next) return
  open = next
  notify()
}

export function toggleArticleTreeOpen(): void {
  setArticleTreeOpen(!open)
}

export function getWindowOffset(): ViewPoint | null {
  return windowOffset
}

export function setWindowOffset(next: ViewPoint): void {
  windowOffset = { x: next.x, y: next.y }
  notify()
}

export function getPan(): ViewPoint {
  return pan
}

export function getZoom(): number {
  return zoom
}

export function getNodePositions(): Record<string, ViewPoint> {
  return nodePos
}

export function bindCanvasSession(id: string): void {
  if (sessionKey === id) return
  sessionKey = id
  nodePos = {}
  pan = { x: 48, y: 36 }
  zoom = 1
  notify()
}

export function mergeCanvasLayout(tree: ViewTree): void {
  const laid = layoutVerticalTree(tree)
  let changed = false
  for (const [id, point] of Object.entries(laid.positions)) {
    if (nodePos[id] === undefined) {
      nodePos[id] = { x: point.x, y: point.y }
      changed = true
    }
  }
  for (const id of Object.keys(nodePos)) {
    if (tree.nodes[id] === undefined) {
      delete nodePos[id]
      changed = true
    }
  }
  if (changed) notify()
}

export function moveCanvasNode(id: string, x: number, y: number): void {
  const current = nodePos[id]
  if (current === undefined) return
  if (current.x === x && current.y === y) return
  nodePos[id] = { x, y }
  notify()
}

export function panCanvas(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return
  pan = { x: pan.x + dx, y: pan.y + dy }
  notify()
}

export function zoomCanvasAt(nextZoom: number, screenX: number, screenY: number): void {
  const clamped = Math.min(2.6, Math.max(0.35, nextZoom))
  if (clamped === zoom) return
  const worldX = (screenX - pan.x) / zoom
  const worldY = (screenY - pan.y) / zoom
  zoom = clamped
  pan = { x: screenX - worldX * zoom, y: screenY - worldY * zoom }
  notify()
}

export function resetCanvasLayout(tree: ViewTree): void {
  const laid = layoutVerticalTree(tree)
  const next: Record<string, ViewPoint> = {}
  for (const [id, point] of Object.entries(laid.positions)) {
    next[id] = { x: point.x, y: point.y }
  }
  nodePos = next
  pan = { x: 48, y: 36 }
  zoom = 1
  notify()
}

/** Test helper: wipe canvas state without touching `open`. */
export function resetArticleTreeCanvas(): void {
  sessionKey = ''
  windowOffset = null
  pan = { x: 48, y: 36 }
  zoom = 1
  nodePos = {}
  notify()
}

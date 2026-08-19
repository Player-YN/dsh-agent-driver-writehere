import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  CANVAS_NODE_H,
  CANVAS_NODE_W,
  childLinkPathDown,
  clipViewText,
  nodeDependsOn,
  viewEdges,
  type ViewTree,
} from './layout.ts'
import type { ArticleTreeKey } from './locales.ts'
import {
  bindCanvasSession,
  getCanvasEpoch,
  getNodePositions,
  getPan,
  getZoom,
  mergeCanvasLayout,
  moveCanvasNode,
  panCanvas,
  subscribeArticleTreeOpen,
  zoomCanvasAt,
} from './store.ts'
import css from './ArticleTreeGraph.module.css'

const WORLD = 8000
const WORLD_ORIGIN = -2000

export function ArticleTreeGraph({
  tree,
  sessionId,
  t,
}: {
  tree: ViewTree
  sessionId: string
  t: (key: ArticleTreeKey) => string
}) {
  useSyncExternalStore(subscribeArticleTreeOpen, getCanvasEpoch, getCanvasEpoch)
  const viewportRef = useRef<HTMLDivElement>(null)
  const drag = useRef<
    | { kind: 'node'; id: string; lastX: number; lastY: number }
    | { kind: 'pan'; lastX: number; lastY: number }
    | undefined
  >(undefined)

  useEffect(() => {
    bindCanvasSession(sessionId)
    mergeCanvasLayout(tree)
  }, [sessionId, tree])

  useEffect(() => {
    const el = viewportRef.current
    if (el === null) return
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08
      zoomCanvasAt(getZoom() * factor, event.clientX - rect.left, event.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel) }
  }, [])

  const pan = getPan()
  const zoom = getZoom()
  const positions = getNodePositions()
  const childEdges = viewEdges(tree).filter(edge => edge.kind === 'child')

  const onPointerMove = (event: PointerEvent): void => {
    const current = drag.current
    if (current === undefined) return
    const dx = event.clientX - current.lastX
    const dy = event.clientY - current.lastY
    current.lastX = event.clientX
    current.lastY = event.clientY
    if (current.kind === 'pan') {
      panCanvas(dx, dy)
      return
    }
    const pos = getNodePositions()[current.id]
    if (pos === undefined) return
    moveCanvasNode(current.id, pos.x + dx / getZoom(), pos.y + dy / getZoom())
  }

  const onPointerUp = (): void => {
    drag.current = undefined
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  const startDrag = (
    kind: 'node' | 'pan',
    event: ReactPointerEvent,
    id?: string,
  ): void => {
    event.preventDefault()
    event.stopPropagation()
    if (kind === 'node' && id !== undefined) {
      drag.current = { kind: 'node', id, lastX: event.clientX, lastY: event.clientY }
    } else {
      drag.current = { kind: 'pan', lastX: event.clientX, lastY: event.clientY }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <div
      ref={viewportRef}
      className={css.viewport}
      data-canvas="article-tree"
      onPointerDown={event => {
        if (event.button !== 0) return
        if ((event.target as HTMLElement).closest('[data-node-id]')) return
        startDrag('pan', event)
      }}
    >
      <div
        className={css.world}
        data-world="true"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <svg
          className={css.edges}
          width={WORLD}
          height={WORLD}
          viewBox={`${WORLD_ORIGIN} ${WORLD_ORIGIN} ${WORLD} ${WORLD}`}
          role="img"
          aria-label={tree.topic}
          style={{ left: WORLD_ORIGIN, top: WORLD_ORIGIN }}
        >
          {childEdges.map((edge) => {
            const from = positions[edge.from]
            const to = positions[edge.to]
            if (!from || !to) return null
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                data-edge="child"
                data-from={edge.from}
                data-to={edge.to}
                className={css.edge}
                d={childLinkPathDown(from, to)}
              />
            )
          })}
        </svg>
        {Object.values(tree.nodes).map((node) => {
          const pos = positions[node.id]
          if (!pos) return null
          const deps = nodeDependsOn(node)
          const statusClass = css[node.status] as string | undefined
          const typeClass = css[node.type] as string | undefined
          return (
            <article
              key={node.id}
              className={`${css.node} ${typeClass ?? ''} ${statusClass ?? ''}`}
              data-node-id={node.id}
              data-x={pos.x}
              data-y={pos.y}
              data-waits-on={deps.join(',')}
              style={{
                width: CANVAS_NODE_W,
                height: CANVAS_NODE_H,
                left: pos.x - CANVAS_NODE_W / 2,
                top: pos.y - CANVAS_NODE_H / 2,
              }}
              onPointerDown={event => {
                if (event.button !== 0) return
                startDrag('node', event, node.id)
              }}
            >
              <div className={css.meta}>
                <span className={css.kind}>{clipViewText(`${node.type.toUpperCase()} · ${node.id}`, 22)}</span>
                <span className={css.status}>{node.status}</span>
              </div>
              <p className={css.goal}>{node.goal}</p>
              {deps.length > 0 && (
                <p className={css.wait}>{`${t('wait')} ${deps.join(', ')}`}</p>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}

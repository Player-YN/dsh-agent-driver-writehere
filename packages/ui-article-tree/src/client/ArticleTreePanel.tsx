import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ViewTree } from './layout.ts'
import { ArticleTreeGraph } from './ArticleTreeGraph.tsx'
import {
  getCanvasEpoch,
  getWindowOffset,
  isArticleTreeOpen,
  resetCanvasLayout,
  setArticleTreeOpen,
  setWindowOffset,
  subscribeArticleTreeOpen,
} from './store.ts'
import { isEditorSession } from './editor-session.ts'
import type { ArticleTreeKey } from './locales.ts'
import css from './ArticleTreePanel.module.css'

const TITLE_ID = 'article-tree-dialog-title'

export function ArticleTreePanel({
  ctx,
  t,
}: {
  ctx: ClientContext
  t: (key: ArticleTreeKey) => string
}) {
  useSyncExternalStore(subscribeArticleTreeOpen, getCanvasEpoch, getCanvasEpoch)
  const open = isArticleTreeOpen()
  const offset = getWindowOffset()
  const windowRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ lastX: number; lastY: number } | undefined>(undefined)

  const tree = useSyncExternalStore(
    (onStoreChange) => {
      let unsubProj = (): void => {}
      const rebind = (): void => {
        unsubProj()
        const id = ctx.sessions.list.getSnapshot().current
        const session = id ? ctx.sessions.binding(id)?.session : undefined
        unsubProj = session ? session.projections.faceOf('articleTree').subscribe(onStoreChange) : () => {}
      }
      const unsubList = ctx.sessions.list.subscribe(() => {
        rebind()
        onStoreChange()
      })
      rebind()
      return () => {
        unsubList()
        unsubProj()
      }
    },
    () => {
      const id = ctx.sessions.list.getSnapshot().current
      const session = id ? ctx.sessions.binding?.(id)?.session : undefined
      return session?.projections.faceOf('articleTree').getSnapshot() as ViewTree | null | undefined
    },
    () => null,
  )

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setArticleTreeOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  const onHeaderPointerDown = (event: ReactPointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('button')) return
    event.preventDefault()
    const box = windowRef.current?.getBoundingClientRect()
    if (box !== undefined && getWindowOffset() === null) {
      setWindowOffset({ x: box.left, y: box.top })
    }
    drag.current = { lastX: event.clientX, lastY: event.clientY }
    const move = (next: PointerEvent): void => {
      const current = drag.current
      if (current === undefined) return
      const origin = getWindowOffset()
      if (origin === null) return
      setWindowOffset({
        x: origin.x + next.clientX - current.lastX,
        y: origin.y + next.clientY - current.lastY,
      })
      current.lastX = next.clientX
      current.lastY = next.clientY
    }
    const up = (): void => {
      drag.current = undefined
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  if (!isEditorSession(ctx) || !open || typeof document === 'undefined') return null

  const close = (): void => { setArticleTreeOpen(false) }
  const sessionId = ctx.sessions.list.getSnapshot().current ?? ''
  return createPortal((
    <div className={css.root} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={close} />
      <div
        ref={windowRef}
        className={css.window}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        data-window-x={offset?.x}
        data-window-y={offset?.y}
        style={offset === null ? undefined : { left: offset.x, top: offset.y }}
      >
        <header className={css.header} onPointerDown={onHeaderPointerDown}>
          <h2 id={TITLE_ID} className={css.title}>{t('title')}</h2>
          <div className={css.actions}>
            {tree && tree.nodes && (
              <button
                type="button"
                className={css.close}
                aria-label={t('reset')}
                onClick={() => { resetCanvasLayout(tree) }}
              >
                {t('reset')}
              </button>
            )}
            <button type="button" className={css.close} aria-label={t('toggle.close')} onClick={close}>
              {t('toggle.close')}
            </button>
          </div>
        </header>
        <div className={css.canvas}>
          {tree && tree.nodes
            ? <ArticleTreeGraph tree={tree} sessionId={sessionId} t={t} />
            : <p className={css.empty}>{t('empty')}</p>}
        </div>
      </div>
    </div>
  ), document.body)
}

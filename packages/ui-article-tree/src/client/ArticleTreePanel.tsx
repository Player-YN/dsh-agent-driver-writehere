import { useSyncExternalStore } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ViewTree } from './layout.ts'
import { ArticleTreeGraph } from './ArticleTreeGraph.tsx'
import { isArticleTreeOpen, subscribeArticleTreeOpen } from './store.ts'
import { isEditorSession } from './editor-session.ts'
import type { ArticleTreeKey } from './locales.ts'
import css from './ArticleTreePanel.module.css'

export function ArticleTreePanel({
  ctx,
  wide,
  t,
}: {
  ctx: ClientContext
  wide: boolean
  t: (key: ArticleTreeKey) => string
}) {
  const open = useSyncExternalStore(subscribeArticleTreeOpen, isArticleTreeOpen, isArticleTreeOpen)
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

  if (!isEditorSession(ctx) || !open || !wide) return null
  return (
    <section className={css.panel} aria-label={t('title')}>
      <h3 className={css.title}>{t('title')}</h3>
      {tree && tree.nodes
        ? <ArticleTreeGraph tree={tree} />
        : <p className={css.empty}>{t('empty')}</p>}
    </section>
  )
}

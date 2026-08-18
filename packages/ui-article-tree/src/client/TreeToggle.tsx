import { useSyncExternalStore } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { isArticleTreeOpen, subscribeArticleTreeOpen, toggleArticleTreeOpen } from './store.ts'
import { isEditorSession } from './editor-session.ts'
import type { ArticleTreeKey } from './locales.ts'
import css from './TreeToggle.module.css'

export function TreeToggle({
  wide,
  t,
  ctx,
}: {
  wide: boolean
  t: (key: ArticleTreeKey) => string
  ctx: ClientContext
}) {
  const editor = useSyncExternalStore(
    onChange => ctx.sessions.list.subscribe(onChange),
    () => isEditorSession(ctx),
    () => false,
  )
  const open = useSyncExternalStore(subscribeArticleTreeOpen, isArticleTreeOpen, isArticleTreeOpen)
  if (!editor) return null
  return (
    <button
      type="button"
      className={css.btn}
      aria-pressed={open}
      aria-label={t('toggle.open')}
      onClick={() => { toggleArticleTreeOpen() }}
    >
      {wide ? t('toggle.label') : '树'}
    </button>
  )
}

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { TreeToggle } from './TreeToggle.tsx'
import { en, zh, type ArticleTreeKey } from './locales.ts'

export type { ArticleTreeKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    articleTree: ArticleTreeKey
  }
}

const NS = 'articleTree'

export const inject = ['slots', 'locale', 'sessions']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-article-tree: dictionaries')

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'article-tree-toggle',
    order: 20,
    locale: NS,
    inject: () => ({ ctx }),
  }, TreeToggle))
}

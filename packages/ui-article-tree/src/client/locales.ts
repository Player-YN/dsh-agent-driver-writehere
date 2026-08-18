export type ArticleTreeKey =
  | 'toggle.label'
  | 'toggle.open'
  | 'empty'
  | 'title'

export const zh: Record<ArticleTreeKey, string> = {
  'toggle.label': '拆卡树',
  'toggle.open': '打开拆卡树',
  empty: '对本会话说主题后，树会在这里向右长出来。think/task 默认可执行；再拆必须 atomic:false。needs-update 表示依赖刚齐，先改本卡 goal。',
  title: '拆卡树',
}

export const en: Record<ArticleTreeKey, string> = {
  'toggle.label': 'Card tree',
  'toggle.open': 'Open card tree',
  empty: 'Send a topic in this session and the tree grows to the right here. think/task default atomic; split only with atomic:false. needs-update means deps just finished — refine this node first.',
  title: 'Card tree',
}

export type ArticleTreeKey =
  | 'toggle.label'
  | 'toggle.open'
  | 'toggle.close'
  | 'empty'
  | 'title'
  | 'wait'
  | 'reset'

export const zh: Record<ArticleTreeKey, string> = {
  'toggle.label': '拆卡树',
  'toggle.open': '打开拆卡树',
  'toggle.close': '关闭拆卡树',
  empty: '对本会话说主题后，树会在这块画布里从上往下展开。拖窗口、拖节点、空白处拖动画布；滚轮缩放。依赖显示为「等」，不是树枝。',
  title: '拆卡树',
  wait: '等',
  reset: '复位布局',
}

export const en: Record<ArticleTreeKey, string> = {
  'toggle.label': 'Card tree',
  'toggle.open': 'Open card tree',
  'toggle.close': 'Close card tree',
  empty: 'Send a topic and the tree unfolds downward on this canvas. Drag the window, drag cards, pan the empty canvas, and scroll to zoom. Dependencies are wait chips, not extra branches.',
  title: 'Card tree',
  wait: 'waiting on',
  reset: 'Reset layout',
}

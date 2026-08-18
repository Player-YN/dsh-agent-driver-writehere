/** Sidebar tree pane open state — process-local, not persisted. */

const listeners = new Set<() => void>()
let open = true

export function isArticleTreeOpen(): boolean {
  return open
}

export function setArticleTreeOpen(next: boolean): void {
  if (open === next) return
  open = next
  for (const listener of listeners) listener()
}

export function toggleArticleTreeOpen(): void {
  setArticleTreeOpen(!open)
}

export function subscribeArticleTreeOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

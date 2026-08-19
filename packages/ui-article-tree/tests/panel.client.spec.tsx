// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { ArticleTreePanel } from '../src/client/ArticleTreePanel.tsx'
import { resetArticleTreeCanvas, setArticleTreeOpen } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'
import type { ViewNode, ViewTree } from '../src/client/layout.ts'

afterEach(() => {
  setArticleTreeOpen(false)
  resetArticleTreeCanvas()
  cleanup()
})

function node(over: Partial<ViewNode> & Pick<ViewNode, 'id' | 'type'>): ViewNode {
  return {
    goal: over.id,
    status: 'ready',
    children: [],
    dependsOn: [],
    ...over,
  }
}

function tree(): ViewTree {
  return {
    topic: '选题',
    nodes: {
      root: node({ id: 'root', type: 'write', children: ['a'] }),
      a: node({ id: 'a', type: 'think' }),
    },
  }
}

function mockCtx(preset: string, snapshot: ViewTree | null): ClientContext {
  const list = {
    current: 's1',
    byId: { s1: { agentPreset: preset } },
  }
  return {
    sessions: {
      list: {
        subscribe: () => () => {},
        getSnapshot: () => list,
      },
      binding: () => ({
        session: {
          projections: {
            faceOf: () => ({
              subscribe: () => () => {},
              getSnapshot: () => snapshot,
            }),
          },
        },
      }),
    },
  } as unknown as ClientContext
}

describe('article tree window', () => {
  it('does not render a dialog while closed', () => {
    render(<ArticleTreePanel ctx={mockCtx('article-editor', tree())} t={key => zh[key]} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens a page-level dialog, not a sidebar pane', () => {
    setArticleTreeOpen(true)
    render(<ArticleTreePanel ctx={mockCtx('article-editor', tree())} t={key => zh[key]} />)
    const dialog = screen.getByRole('dialog', { name: '拆卡树' })
    expect(dialog).toBeTruthy()
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(screen.getByRole('img', { name: '选题' })).toBeTruthy()
  })

  it('closes on mask click', () => {
    setArticleTreeOpen(true)
    render(<ArticleTreePanel ctx={mockCtx('article-editor', tree())} t={key => zh[key]} />)
    fireEvent.click(document.querySelector('[aria-hidden="true"]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes on Escape and the close button', () => {
    setArticleTreeOpen(true)
    const { unmount } = render(<ArticleTreePanel ctx={mockCtx('article-editor', tree())} t={key => zh[key]} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()
    setArticleTreeOpen(true)
    render(<ArticleTreePanel ctx={mockCtx('article-editor', tree())} t={key => zh[key]} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭拆卡树' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows the empty copy when the session has no tree yet', () => {
    setArticleTreeOpen(true)
    render(<ArticleTreePanel ctx={mockCtx('article-editor', null)} t={key => zh[key]} />)
    expect(screen.getByText(/对本会话说主题后/)).toBeTruthy()
  })

  it('drags the window from the title bar', () => {
    setArticleTreeOpen(true)
    render(<ArticleTreePanel ctx={mockCtx('article-editor', tree())} t={key => zh[key]} />)
    const dialog = screen.getByRole('dialog', { name: '拆卡树' })
    Object.defineProperty(dialog, 'getBoundingClientRect', {
      value: () => ({ left: 40, top: 50, right: 400, bottom: 400, width: 360, height: 350, x: 40, y: 50, toJSON() { return {} } }),
    })
    const header = dialog.querySelector('header')!
    fireEvent.pointerDown(header, { button: 0, clientX: 80, clientY: 60, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 120, clientY: 90, pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })
    expect(dialog.getAttribute('data-window-x')).not.toBeNull()
  })

  it('stays closed for a non-editor session', () => {
    setArticleTreeOpen(true)
    render(<ArticleTreePanel ctx={mockCtx('standard', tree())} t={key => zh[key]} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

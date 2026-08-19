// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArticleTreeGraph } from '../src/client/ArticleTreeGraph.tsx'
import { zh } from '../src/client/locales.ts'
import { resetArticleTreeCanvas } from '../src/client/store.ts'
import type { ViewNode, ViewTree } from '../src/client/layout.ts'

afterEach(() => {
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

function dagTree(): ViewTree {
  return {
    topic: '选题',
    nodes: {
      root: node({ id: 'root', type: 'write', status: 'waiting', children: ['a', 'b', 'c'] }),
      a: node({
        id: 'a',
        type: 'think',
        goal: 'a-very-long-goal-label',
        status: 'ready',
      }),
      b: node({ id: 'b', type: 'search', status: 'ready' }),
      c: node({ id: 'c', type: 'write', status: 'blocked', dependsOn: ['a'] }),
      orphan: node({ id: 'orphan', type: 'think', dependsOn: ['a'] }),
      hanging: node({ id: 'hanging', type: 'search' }),
    },
  }
}

const t = (key: keyof typeof zh) => zh[key]

describe('article tree graph DAG', () => {
  it('fans siblings, draws only parent-child edges, and shows wait chips', () => {
    const tree = dagTree()
    tree.nodes.a!.dependsOn = ['orphan']
    const { container } = render(<ArticleTreeGraph tree={tree} sessionId="s1" t={t} />)
    const a = container.querySelector('[data-node-id="a"]')
    const b = container.querySelector('[data-node-id="b"]')
    const c = container.querySelector('[data-node-id="c"]')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(c).not.toBeNull()
    expect(a!.getAttribute('data-y')).toBe(b!.getAttribute('data-y'))
    expect(a!.getAttribute('data-x')).not.toBe(b!.getAttribute('data-x'))
    expect(c!.getAttribute('data-waits-on')).toBe('a')
    expect(c!.textContent).toContain('等 a')
    expect(container.querySelector('[data-node-id="orphan"]')).toBeNull()
    expect(container.querySelector('[data-node-id="hanging"]')).toBeNull()
    expect(container.querySelectorAll('[data-edge="child"]')).toHaveLength(3)
    expect(container.querySelector('[data-edge="depends"]')).toBeNull()
    expect(a!.textContent).toContain('a-very-long-goal-label')
  })

  it('marks a needs-update node with the status class the stylesheet styles', () => {
    const tree: ViewTree = {
      topic: '选题',
      nodes: {
        root: node({ id: 'root', type: 'write', status: 'waiting', children: ['a'] }),
        a: node({ id: 'a', type: 'write', status: 'needs-update', dependsOn: ['root'] }),
      },
    }
    const { container } = render(<ArticleTreeGraph tree={tree} sessionId="s1" t={t} />)
    const a = container.querySelector('[data-node-id="a"]')
    expect(a?.getAttribute('class')).toMatch(/needs-update/)
    expect(a?.textContent).toContain('needs-update')
  })

  it('keeps the parent-child edge attached when a node is dragged', () => {
    const tree = dagTree()
    const { container } = render(<ArticleTreeGraph tree={tree} sessionId="s1" t={t} />)
    const a = container.querySelector('[data-node-id="a"]')!
    const before = a.getAttribute('data-x')
    const edge = container.querySelector('[data-edge="child"][data-from="root"][data-to="a"]')!
    const pathBefore = edge.getAttribute('d')
    fireEvent.pointerDown(a, { button: 0, clientX: 200, clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(window, { clientX: 280, clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })
    expect(a.getAttribute('data-x')).not.toBe(before)
    expect(edge.getAttribute('d')).not.toBe(pathBefore)
    expect(container.querySelector('[data-edge="child"][data-from="root"][data-to="a"]')).toBe(edge)
  })
})

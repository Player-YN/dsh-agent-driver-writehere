// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ArticleTreeGraph } from '../src/client/ArticleTreeGraph.tsx'
import type { ViewNode, ViewTree } from '../src/client/layout.ts'

afterEach(cleanup)

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

describe('article tree graph DAG', () => {
  it('shows waits-on labels and keeps parallel-ready siblings in one column', () => {
    const tree = dagTree()
    tree.nodes.a!.dependsOn = ['orphan']
    const { container } = render(<ArticleTreeGraph tree={tree} />)
    const a = container.querySelector('[data-node-id="a"]')
    const b = container.querySelector('[data-node-id="b"]')
    const c = container.querySelector('[data-node-id="c"]')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(c).not.toBeNull()
    expect(a!.getAttribute('data-x')).toBe(b!.getAttribute('data-x'))
    expect(a!.getAttribute('data-y')).not.toBe(b!.getAttribute('data-y'))
    expect(c!.getAttribute('data-waits-on')).toBe('a')
    expect(c!.textContent).toContain('waits on: a')
    expect(container.querySelector('[data-node-id="orphan"]')).toBeNull()
    expect(container.querySelector('[data-node-id="hanging"]')).toBeNull()
    expect(container.querySelectorAll('[data-edge="child"]')).toHaveLength(3)
    expect(container.querySelector('[data-edge="depends"][data-from="a"][data-to="c"]')).not.toBeNull()
    expect(container.querySelector('[data-edge="depends"][data-from="orphan"][data-to="a"]')).toBeNull()
    expect(container.querySelector('[data-edge="depends"][data-from="a"][data-to="orphan"]')).toBeNull()
    expect(a!.textContent).toContain('…')
  })

  it('marks a needs-update node with the status class the stylesheet styles', () => {
    const tree: ViewTree = {
      topic: '选题',
      nodes: {
        root: node({ id: 'root', type: 'write', status: 'waiting', children: ['a'] }),
        a: node({ id: 'a', type: 'write', status: 'needs-update', dependsOn: ['root'] }),
      },
    }
    const { container } = render(<ArticleTreeGraph tree={tree} />)
    const a = container.querySelector('[data-node-id="a"]')
    expect(a?.getAttribute('class')).toMatch(/needs-update/)
    expect(a?.textContent).toContain('needs-update')
  })
})

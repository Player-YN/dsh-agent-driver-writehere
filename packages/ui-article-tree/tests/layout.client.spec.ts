import { describe, expect, it } from 'vitest'
import {
  childLinkPath,
  clipViewText,
  dependsLinkPath,
  formatWaitsOn,
  layoutHorizontalTree,
  nodeDependsOn,
  viewEdges,
  type ViewNode,
  type ViewTree,
} from '../src/client/layout.ts'

function node(over: Partial<ViewNode> & Pick<ViewNode, 'id' | 'type'>): ViewNode {
  return {
    goal: over.id,
    status: 'ready',
    children: [],
    dependsOn: [],
    ...over,
  }
}

function siblings(over: Partial<Record<'a' | 'b' | 'c', Partial<ViewNode>>> = {}): ViewTree {
  return {
    topic: 't',
    nodes: {
      root: node({ id: 'root', type: 'write', status: 'waiting', children: ['a', 'b', 'c'] }),
      a: node({ id: 'a', type: 'think', ...over.a }),
      b: node({ id: 'b', type: 'search', ...over.b }),
      c: node({ id: 'c', type: 'write', ...over.c }),
    },
  }
}

describe('sidebar article tree layout', () => {
  it('places children to the right of the root', () => {
    const tree: ViewTree = {
      topic: 't',
      nodes: {
        root: node({ id: 'root', type: 'write', status: 'waiting', children: ['a', 'b'] }),
        a: node({ id: 'a', type: 'think' }),
        b: node({ id: 'b', type: 'search', status: 'blocked' }),
      },
    }
    const layout = layoutHorizontalTree(tree)
    expect(layout.positions.a!.x).toBeGreaterThan(layout.positions.root!.x)
    expect(layout.positions.b!.x).toBeGreaterThan(layout.positions.root!.x)
    expect(layout.positions.a!.y).not.toBe(layout.positions.b!.y)
  })

  it('keeps parallel-ready siblings in one column', () => {
    const layout = layoutHorizontalTree(siblings())
    expect(layout.positions.a!.x).toBe(layout.positions.b!.x)
    expect(layout.positions.b!.x).toBe(layout.positions.c!.x)
    expect(layout.positions.a!.y).not.toBe(layout.positions.b!.y)
  })

  it('does not shift a blocked sibling right when it waits on another sibling', () => {
    const tree = siblings({
      b: { status: 'blocked', dependsOn: ['a'] },
      c: { status: 'blocked', dependsOn: ['a', 'b'] },
    })
    const layout = layoutHorizontalTree(tree)
    expect(layout.positions.a!.x).toBe(layout.positions.b!.x)
    expect(layout.positions.b!.x).toBe(layout.positions.c!.x)
  })
})

describe('article tree view dependsOn', () => {
  it('reads dependsOn from the view node and treats a missing list as empty', () => {
    const waiting = node({ id: 'b', type: 'search', dependsOn: ['a'] })
    expect(nodeDependsOn(waiting)).toEqual(['a'])
    expect(formatWaitsOn(nodeDependsOn(waiting))).toBe('waits on: a')
    const legacy = { id: 'a', type: 'think', goal: 'a', status: 'ready', children: [] } as ViewNode
    expect(nodeDependsOn(legacy)).toEqual([])
    expect(formatWaitsOn(nodeDependsOn(legacy))).toBeUndefined()
  })

  it('emits child edges plus sibling dependency edges', () => {
    const tree = siblings({
      b: { status: 'blocked', dependsOn: ['a'] },
      c: { status: 'blocked', dependsOn: ['a', 'b'] },
    })
    expect(viewEdges(tree)).toEqual([
      { from: 'root', to: 'a', kind: 'child' },
      { from: 'root', to: 'b', kind: 'child' },
      { from: 'root', to: 'c', kind: 'child' },
      { from: 'a', to: 'b', kind: 'depends' },
      { from: 'a', to: 'c', kind: 'depends' },
      { from: 'b', to: 'c', kind: 'depends' },
    ])
  })

  it('skips unknown ids and does not double-draw a parent-child dependsOn', () => {
    const tree: ViewTree = {
      topic: 't',
      nodes: {
        root: node({
          id: 'root',
          type: 'write',
          children: ['leaf', 'ghost'],
          dependsOn: ['missing'],
        }),
        leaf: node({ id: 'leaf', type: 'write', dependsOn: ['root'] }),
      },
    }
    expect(viewEdges(tree)).toEqual([
      { from: 'root', to: 'leaf', kind: 'child' },
    ])
    expect(layoutHorizontalTree(tree).positions.ghost).toBeUndefined()
  })

  it('clips long labels and draws same-column dependency bows', () => {
    expect(clipViewText('short', 16)).toBe('short')
    expect(clipViewText('abcdefghijklmnopqrst', 16)).toBe('abcdefghijklmno…')
    const across = childLinkPath({ x: 10, y: 20 }, { x: 200, y: 40 })
    expect(across.startsWith('M ')).toBe(true)
    const bow = dependsLinkPath({ x: 100, y: 40 }, { x: 100, y: 120 })
    expect(bow).toContain('206')
    const forward = dependsLinkPath({ x: 10, y: 20 }, { x: 200, y: 40 })
    expect(forward).toBe(across)
    const back = dependsLinkPath({ x: 200, y: 40 }, { x: 10, y: 20 })
    expect(back).not.toBe(across)
    expect(back.startsWith('M ')).toBe(true)
  })
})

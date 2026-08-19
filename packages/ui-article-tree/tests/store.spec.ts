import { afterEach, describe, expect, it } from 'vitest'
import {
  getNodePositions,
  isArticleTreeOpen,
  mergeCanvasLayout,
  moveCanvasNode,
  resetArticleTreeCanvas,
  setArticleTreeOpen,
  subscribeArticleTreeOpen,
  toggleArticleTreeOpen,
} from '../src/client/store.ts'
import type { ViewNode, ViewTree } from '../src/client/layout.ts'

afterEach(() => {
  setArticleTreeOpen(false)
  resetArticleTreeCanvas()
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

describe('article tree window store', () => {
  it('starts closed', () => {
    expect(isArticleTreeOpen()).toBe(false)
  })

  it('toggles and notifies subscribers', () => {
    const seen: boolean[] = []
    const unsub = subscribeArticleTreeOpen(() => { seen.push(isArticleTreeOpen()) })
    toggleArticleTreeOpen()
    expect(isArticleTreeOpen()).toBe(true)
    toggleArticleTreeOpen()
    expect(isArticleTreeOpen()).toBe(false)
    unsub()
    expect(seen).toEqual([true, false])
  })

  it('keeps a user-moved node when the tree later grows', () => {
    const first: ViewTree = {
      topic: 't',
      nodes: {
        root: node({ id: 'root', type: 'write', children: ['a'] }),
        a: node({ id: 'a', type: 'think' }),
      },
    }
    mergeCanvasLayout(first)
    moveCanvasNode('a', 12, 34)
    const grown: ViewTree = {
      topic: 't',
      nodes: {
        root: node({ id: 'root', type: 'write', children: ['a', 'b'] }),
        a: node({ id: 'a', type: 'think' }),
        b: node({ id: 'b', type: 'write' }),
      },
    }
    mergeCanvasLayout(grown)
    expect(getNodePositions().a).toEqual({ x: 12, y: 34 })
    expect(getNodePositions().b).toBeDefined()
  })
})


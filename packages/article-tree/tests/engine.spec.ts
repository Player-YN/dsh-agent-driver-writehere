import { describe, expect, it } from 'vitest'
import {
  allChildrenDone,
  cloneTree,
  commitNode,
  createArticleTree,
  decomposeNode,
  isAtomicFlag,
  layoutHorizontalTree,
  markRunning,
  pickReadyNode,
  reviseParent,
  setGoal,
} from '../src/engine.ts'

function mixedChildren() {
  return [
    { type: 'think' as const, goal: '定尺子' },
    { type: 'task' as const, goal: '拿公开榜' },
    { type: 'write' as const, goal: '写开篇' },
  ]
}

describe('article-tree engine', () => {
  it('creates a non-atomic root write node from the topic', () => {
    const tree = createArticleTree('对照 4.6 与 0813')
    expect(tree.nodes.root!.type).toBe('write')
    expect(tree.nodes.root!.goal).toBe('对照 4.6 与 0813')
    expect(tree.nodes.root!.atomic).toBe(false)
    expect(tree.nodes.root!.dependsOn).toEqual([])
    expect(pickReadyNode(tree)).toBe('root')
  })

  it('rejects an empty topic', () => {
    expect(() => createArticleTree('  ')).toThrow(/non-empty/)
  })

  it('decomposes a write node: think/task default atomic, write stays non-atomic', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', mixedChildren())
    expect(tree.lastOp).toBe('decompose')
    const types = tree.nodes.root!.children.map(id => tree.nodes[id]!.type)
    expect(types).toEqual(['think', 'task', 'write'])
    const [thinkId, taskId, writeId] = tree.nodes.root!.children
    expect(tree.nodes[thinkId!]!.atomic).toBe(true)
    expect(tree.nodes[taskId!]!.atomic).toBe(true)
    expect(tree.nodes[writeId!]!.atomic).toBe(false)
    expect(tree.nodes[writeId!]!.dependsOn).toEqual([])
  })

  it('marks a child atomic only when atomic is true', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'task', goal: '查', atomic: true, id: 's' },
      { type: 'write', goal: '写', atomic: false, id: 'w' },
    ])
    expect(tree.nodes.s!.atomic).toBe(true)
    expect(tree.nodes.w!.atomic).toBe(false)
    expect(() => decomposeNode(tree, 's', [{ type: 'write', goal: '再拆' }])).toThrow(/atomic/)
  })

  it('makes siblings without dependsOn ready in parallel', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', mixedChildren())
    const [thinkId, searchId, writeId] = tree.nodes.root!.children
    expect(tree.nodes[thinkId!]!.status).toBe('ready')
    expect(tree.nodes[searchId!]!.status).toBe('ready')
    expect(tree.nodes[writeId!]!.status).toBe('ready')
    expect(tree.nodes.root!.status).toBe('waiting')
    expect(allChildrenDone(tree, 'root')).toBe(false)
    expect(pickReadyNode(tree)).toBe(thinkId)
  })

  it('keeps a sibling ready after another parallel sibling commits', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'task', goal: '公开榜日期' },
      { type: 'write', goal: '写开篇比总分' },
    ])
    const searchId = tree.nodes.root!.children[0]!
    const writeId = tree.nodes.root!.children[1]!
    expect(tree.nodes[writeId]!.status).toBe('ready')
    tree = commitNode(tree, searchId, '公开榜停在 8 月 7 日，没有 4.6')
    expect(tree.nodes[searchId]!.status).toBe('done')
    expect(tree.nodes[writeId]!.status).toBe('ready')
    const before = tree.nodes.root!.goal
    tree = reviseParent(tree, searchId, '分开写公开榜与厂商表，不拿 45 打 61')
    expect(tree.lastOp).toBe('revise-parent')
    expect(tree.nodes.root!.goal).not.toBe(before)
    expect(tree.nodes.root!.goal).toContain('分开写')
  })

  it('blocks a sibling until its dependsOn nodes are done', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'task', goal: 'A', id: 'a' },
      { type: 'task', goal: 'B', id: 'b', dependsOn: ['a'] },
      { type: 'write', goal: 'C', id: 'c', dependsOn: ['a', 'b'] },
    ])
    expect(tree.nodes.a!.status).toBe('ready')
    expect(tree.nodes.b!.status).toBe('blocked')
    expect(tree.nodes.c!.status).toBe('blocked')
    expect(() => commitNode(tree, 'c', '太早')).toThrow(/blocked/)
    tree = commitNode(tree, 'a', 'A done')
    expect(tree.nodes.b!.status).toBe('needs-update')
    expect(tree.nodes.c!.status).toBe('blocked')
    expect(() => commitNode(tree, 'b', 'too soon')).toThrow(/not committable/)
    tree = setGoal(tree, 'b', 'B after A')
    expect(tree.nodes.b!.status).toBe('ready')
    expect(tree.lastOp).toBe('update')
    tree = commitNode(tree, 'b', 'B done')
    expect(tree.nodes.c!.status).toBe('needs-update')
    tree = setGoal(tree, 'c', 'C after A and B')
    expect(tree.nodes.c!.status).toBe('ready')
  })

  it('picks the ready node with minimum BFS depth, then tree.order', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: '浅层可再拆', id: 'shallow-think', atomic: false },
      { type: 'write', goal: '浅层成稿', id: 'shallow-write' },
    ])
    tree = decomposeNode(tree, 'shallow-think', [
      { type: 'task', goal: '深层检索', id: 'deep' },
    ])
    expect(tree.nodes['shallow-write']!.status).toBe('ready')
    expect(tree.nodes.deep!.status).toBe('ready')
    expect(pickReadyNode(tree)).toBe('shallow-write')
    const withHole = cloneTree(tree)
    withHole.order.unshift('missing')
    expect(pickReadyNode(withHole)).toBe('shallow-write')
  })

  it('returns null from pickReadyNode when nothing is ready', () => {
    const tree = commitNode(createArticleTree('对照稿'), 'root', '一篇写完')
    expect(pickReadyNode(tree)).toBeNull()
  })

  it('commits a write leaf as mid-tree composition, not a terminal answer list', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    tree = commitNode(tree, 'open', '榜停在 7 号，两家 12 号才上市。')
    expect(tree.nodes.open!.type).toBe('write')
    expect(tree.nodes.open!.result).toMatch(/榜停在/)
    expect(tree.lastOp).toBe('commit')
    expect(allChildrenDone(tree, 'root')).toBe(true)
    expect(tree.nodes.root!.status).toBe('ready')
  })

  it('allows a parent write commit after every child is done', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    tree = commitNode(tree, 'open', '叶子段')
    tree = commitNode(tree, 'root', '父节点合成段')
    expect(tree.nodes.root!.status).toBe('done')
    expect(tree.nodes.root!.result).toBe('父节点合成段')
    expect(pickReadyNode(tree)).toBeNull()
  })

  it('rejects parent write commit while the parent is still waiting', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    expect(() => commitNode(tree, 'root', '太早')).toThrow(/waiting/)
  })

  it('rejects a ready non-atomic write commit before children are done', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    tree.nodes.root!.status = 'ready'
    expect(() => commitNode(tree, 'root', '太早')).toThrow(/children are done/)
  })

  it('rejects write decompose when no child is write or a non-task card follows the last write', () => {
    const base = createArticleTree('对照稿')
    expect(() => decomposeNode(base, 'root', [
      { type: 'task', goal: '只搜' },
      { type: 'think', goal: '只想' },
    ])).toThrow(/at least one write/)
    expect(() => decomposeNode(base, 'root', [
      { type: 'write', goal: '先写' },
      { type: 'think', goal: '后想' },
    ])).toThrow(/last child to be write/)
  })

  it('resolves numeric dependsOn to sibling ids', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '先写', id: 'open' },
      { type: 'task', goal: '后搜', id: 'push', dependsOn: ['0'] },
    ])
    expect(tree.nodes.push!.dependsOn).toEqual(['open'])
  })

  it('resolves numeric dependsOn under think and task parents, not only write', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: '推理', id: 'mid', atomic: false },
      { type: 'write', goal: '成稿', id: 'w' },
    ])
    tree = decomposeNode(tree, 'mid', [
      { type: 'task', goal: '查证', id: 'probe' },
      { type: 'think', goal: '归纳', id: 'sum', dependsOn: ['0'] },
    ])
    expect(tree.nodes.sum!.dependsOn).toEqual(['probe'])
  })

  it('lets a trailing task follow a write and depend on that write', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '先写', id: 'open' },
      { type: 'task', goal: '后搜', id: 'push' },
    ])
    expect(tree.nodes.push!.dependsOn).toEqual(['open'])
    expect(tree.nodes.push!.status).toBe('blocked')
    expect(tree.nodes.open!.status).toBe('ready')
  })

  it('allows think/task decompose without a trailing write', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: '推理', id: 'think', atomic: false },
      { type: 'write', goal: '成稿', id: 'write' },
    ])
    tree = decomposeNode(tree, 'think', [
      { type: 'task', goal: '查一点' },
      { type: 'think', goal: '再想' },
    ])
    expect(tree.nodes.think!.children).toHaveLength(2)
    expect(tree.nodes[tree.nodes.think!.children[1]!]!.type).toBe('think')
  })

  it('resolves isAtomicFlag from the stored flag or a true decision', () => {
    const tree = createArticleTree('对照稿')
    expect(isAtomicFlag(tree.nodes.root!)).toBe(false)
    expect(isAtomicFlag(tree.nodes.root!, false)).toBe(false)
    expect(isAtomicFlag(tree.nodes.root!, true)).toBe(true)
    const atomic = decomposeNode(tree, 'root', [
      { type: 'write', goal: '原子写', id: 'leaf', atomic: true },
    ])
    expect(isAtomicFlag(atomic.nodes.leaf!)).toBe(true)
    expect(isAtomicFlag(atomic.nodes.leaf!, false)).toBe(true)
  })

  it('lays out a root-only tree', () => {
    const layout = layoutHorizontalTree(createArticleTree('对照稿'))
    expect(layout.positions.root).toBeTruthy()
    expect(layout.width).toBeGreaterThan(0)
    expect(layout.height).toBeGreaterThanOrEqual(220)
  })

  it('lays out depth along X so the tree expands horizontally', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: 'a' },
      { type: 'task', goal: 'b' },
      { type: 'write', goal: 'c' },
    ])
    const layout = layoutHorizontalTree(tree)
    const rootX = layout.positions.root!.x
    for (const id of tree.nodes.root!.children) {
      expect(layout.positions[id]!.x).toBeGreaterThan(rootX)
    }
    const ys = tree.nodes.root!.children.map(id => layout.positions[id]!.y)
    expect(ys[0]).not.toBe(ys[1])
  })

  it('places a missing child as a leaf span and skips its position', () => {
    const tree = createArticleTree('对照稿')
    tree.nodes.root!.children.push('ghost')
    const layout = layoutHorizontalTree(tree)
    expect(layout.positions.root).toBeTruthy()
    expect(layout.positions.ghost).toBeUndefined()
  })

  it('rejects illegal decompose, commit, revise, and dispatch inputs', () => {
    const tree = createArticleTree('对照稿')
    expect(() => decomposeNode(tree, 'nope', mixedChildren())).toThrow(/unknown node/)
    expect(() => decomposeNode(tree, 'root', [
      { type: 'write', goal: '撞 root', id: 'root' },
    ])).toThrow(/already exists/)
    expect(() => decomposeNode(tree, 'root', [])).toThrow(/at least one child/)
    expect(() => decomposeNode(tree, 'root', [
      { type: 'write', goal: '  ' },
    ])).toThrow(/non-empty/)
    expect(() => decomposeNode(tree, 'root', [
      { type: 'write', goal: 'a', id: 'dup' },
      { type: 'write', goal: 'b', id: 'dup' },
    ])).toThrow(/already exists/)
    expect(() => decomposeNode(tree, 'root', [
      { type: 'write', goal: 'a', id: 'self', dependsOn: ['self'] },
    ])).toThrow(/depend on itself/)
    const repaired = decomposeNode(tree, 'root', [
      { type: 'write', goal: 'a', dependsOn: ['missing'] },
    ])
    const repairedId = repaired.nodes.root!.children[0]!
    expect(repaired.nodes[repairedId]!.dependsOn).toEqual([])
    expect(() => commitNode(tree, 'nope', 'x')).toThrow(/unknown node/)
    expect(() => commitNode(tree, 'root', '  ')).toThrow(/non-empty/)
    expect(() => reviseParent(tree, 'nope', 'x')).toThrow(/unknown node/)
    expect(() => reviseParent(tree, 'root', 'x')).toThrow(/no parent/)
    expect(() => markRunning(tree, 'nope')).toThrow(/unknown node/)
    const done = commitNode(tree, 'root', '写完')
    expect(() => decomposeNode(done, 'root', mixedChildren())).toThrow(/done node/)
    expect(() => commitNode(done, 'root', '再写')).toThrow(/not committable/)
    expect(() => markRunning(done, 'root')).toThrow(/not ready/)
  })

  it('revises a parent goal and rejects a missing parent or empty goal', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    expect(() => reviseParent(tree, 'open', '  ')).toThrow(/non-empty/)
    const orphan = cloneTree(tree)
    orphan.nodes.open!.parentId = 'gone'
    expect(() => reviseParent(orphan, 'open', '新目标')).toThrow(/missing parent/)
    const revised = reviseParent(tree, 'open', '  新目标  ')
    expect(revised.nodes.root!.goal).toBe('新目标')
    expect(revised.selectedId).toBe('root')
  })

  it('commits a running node and treats allChildrenDone as true for missing nodes', () => {
    const tree = markRunning(createArticleTree('对照稿'), 'root')
    expect(tree.nodes.root!.status).toBe('running')
    expect(tree.lastOp).toBe('dispatch')
    const committed = commitNode(tree, 'root', '跑完')
    expect(committed.nodes.root!.status).toBe('done')
    expect(allChildrenDone(tree, 'missing')).toBe(true)
    expect(allChildrenDone(createArticleTree('对照稿'), 'root')).toBe(true)
  })

  it('keeps a waiting parent blocked on unfinished dependsOn after children finish', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: '先拆', id: 'mid', atomic: false },
      { type: 'write', goal: '依赖对象', id: 'dep' },
    ])
    tree.nodes.mid!.dependsOn = ['dep']
    tree = decomposeNode(tree, 'mid', [{ type: 'write', goal: '叶子', id: 'leaf' }])
    tree = commitNode(tree, 'leaf', '叶子完成')
    expect(tree.nodes.mid!.status).toBe('waiting')
    tree = commitNode(tree, 'dep', '依赖完成')
    expect(tree.nodes.mid!.status).toBe('ready')
  })

  it('blocks a non-done child whose parent is no longer waiting', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'task', goal: 'A', id: 'a' },
      { type: 'write', goal: 'B', id: 'b' },
    ])
    tree.nodes.root!.status = 'ready'
    tree = commitNode(tree, 'a', 'A')
    expect(tree.nodes.b!.status).toBe('blocked')
  })

  it('breaks a parent-pointer cycle when measuring BFS depth', () => {
    const tree = createArticleTree('对照稿')
    tree.nodes.root!.parentId = 'root'
    expect(pickReadyNode(tree)).toBe('root')
  })

  it('rewrites this node goal via setGoal and does not touch the parent', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '开篇', id: 'open' },
    ])
    const updated = setGoal(tree, 'open', '  只写现象  ')
    expect(updated.nodes.open!.goal).toBe('只写现象')
    expect(updated.nodes.root!.goal).toBe('对照稿')
    expect(updated.lastOp).toBe('update')
    expect(updated.selectedId).toBe('open')
    expect(() => setGoal(tree, 'nope', 'x')).toThrow(/unknown node/)
    expect(() => setGoal(tree, 'open', '  ')).toThrow(/non-empty/)
  })

  it('chains sibling write and think nodes and marks the follower needs-update after the predecessor commits', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '先写', id: 'w1' },
      { type: 'write', goal: '后写', id: 'w2' },
    ])
    expect(tree.nodes.w2!.dependsOn).toEqual(['w1'])
    expect(tree.nodes.w1!.status).toBe('ready')
    expect(tree.nodes.w2!.status).toBe('blocked')
    tree = commitNode(tree, 'w1', '第一段')
    expect(tree.nodes.w2!.status).toBe('needs-update')
    expect(pickReadyNode(tree)).toBe('w2')
    tree = setGoal(tree, 'w2', '后写，接上第一段')
    expect(tree.nodes.w2!.status).toBe('ready')

    tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: '先想', id: 't1' },
      { type: 'think', goal: '后想', id: 't2' },
      { type: 'write', goal: '成稿', id: 'w' },
    ])
    expect(tree.nodes.t2!.dependsOn).toEqual(['t1'])
    expect(tree.nodes.t1!.atomic).toBe(true)
    expect(tree.nodes.t2!.atomic).toBe(true)
    expect(tree.nodes.w!.dependsOn).toEqual([])
  })

  it('lets atomic:false override the think/task default', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'think', goal: '再拆', atomic: false, id: 't' },
      { type: 'write', goal: '写', id: 'w' },
    ])
    expect(tree.nodes.t!.atomic).toBe(false)
  })

  it('treats a missing dependsOn list as empty during readiness', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '叶', id: 'leaf' },
    ])
    delete (tree.nodes.leaf as { dependsOn?: string[] }).dependsOn
    tree.order.push('missing')
    tree = commitNode(tree, 'leaf', '完成')
    expect(tree.nodes.root!.status).toBe('ready')
  })
})

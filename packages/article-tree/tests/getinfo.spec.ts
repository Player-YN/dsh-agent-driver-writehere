import { describe, expect, it } from 'vitest'
import { commitNode, createArticleTree, decomposeNode } from '../src/engine.ts'
import { getExecuteInfo, getNodeInfo, getPlannerInfo, MAX_ANCESTOR_DEPTH } from '../src/getinfo.ts'

describe('GetInfo planner vs execute', () => {
  it('returns ancestors root-first, dependency results, and draft; ledger stays out of the envelope', () => {
    let tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'task', goal: '查榜', id: 'search' },
      { type: 'think', goal: '拆层', id: 'think', atomic: false },
      { type: 'write', goal: '成稿', id: 'write', dependsOn: ['search'] },
    ])
    tree = decomposeNode(tree, 'think', [
      { type: 'write', goal: '深层写', id: 'deep', dependsOn: ['search'] },
    ])
    tree = commitNode(tree, 'search', '榜停在 7 号')

    const execute = getExecuteInfo(tree, 'deep', { draft: '# 对照稿\n\n半成品' })
    expect(execute.node.id).toBe('deep')
    expect(execute.node.goal).toBe('深层写')
    expect(execute.ancestors).toEqual([
      { id: 'root', goal: '对照稿', result: null },
      { id: 'think', goal: '拆层', result: null },
    ])
    expect(execute.deps).toEqual([
      { id: 'search', goal: '查榜', result: '榜停在 7 号' },
    ])
    expect(execute.draft).toBe('# 对照稿\n\n半成品')
    expect(execute.graph).toBeUndefined()
    expect(execute).not.toHaveProperty('ledgerHits')

    const planner = getPlannerInfo(tree, 'deep', { draft: '# 对照稿\n\n半成品' })
    expect(planner.graph).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'root', type: 'write', status: 'waiting' }),
      expect.objectContaining({ id: 'search', type: 'task', status: 'done', deps: [] }),
      expect.objectContaining({ id: 'deep', type: 'write', deps: ['search'] }),
    ]))
    expect(planner).not.toHaveProperty('ledgerHits')

    const deprecated = getNodeInfo(tree, 'deep', {
      draft: '# 对照稿\n\n半成品',
      ledgerHits: ['concepts:公开榜'],
    })
    expect(deprecated).not.toHaveProperty('ledgerHits')
    expect(deprecated.graph).toBeUndefined()
  })

  it('returns empty ancestors on root and empty deps when none are declared', () => {
    const tree = createArticleTree('对照稿')
    const info = getExecuteInfo(tree, 'root', { draft: '' })
    expect(info.ancestors).toEqual([])
    expect(info.deps).toEqual([])
    expect(info.node.id).toBe('root')
    expect(getPlannerInfo(tree, 'root', { draft: '' }).graph).toEqual([
      expect.objectContaining({ id: 'root', type: 'write', goal: '对照稿', deps: [], status: 'ready' }),
    ])
  })

  it('rejects an unknown node', () => {
    expect(() => getExecuteInfo(createArticleTree('对照稿'), 'nope', { draft: '' }))
      .toThrow(/unknown node/)
  })

  it('stubs missing dependency nodes and stops a broken ancestor chain', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '叶', id: 'leaf', dependsOn: [] },
    ])
    tree.nodes.leaf!.dependsOn = ['ghost-dep']
    tree.nodes.leaf!.parentId = 'ghost-parent'
    const info = getExecuteInfo(tree, 'leaf', { draft: 'd' })
    expect(info.ancestors).toEqual([])
    expect(info.deps).toEqual([{ id: 'ghost-dep', goal: '', result: null }])
  })

  it('breaks an ancestor parent-pointer cycle', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '叶', id: 'leaf' },
    ])
    tree.nodes.leaf!.parentId = 'loop'
    tree.nodes.loop = {
      id: 'loop',
      parentId: 'leaf',
      type: 'think',
      goal: '环',
      status: 'waiting',
      atomic: false,
      result: null,
      children: ['leaf'],
      dependsOn: [],
    }
    const info = getExecuteInfo(tree, 'leaf', { draft: '' })
    expect(info.ancestors.map(item => item.id)).toEqual(['loop'])

    tree.nodes.loop!.parentId = 'root'
    tree.nodes.root!.parentId = 'loop'
    const amongAncestors = getExecuteInfo(tree, 'leaf', { draft: '' })
    expect(amongAncestors.ancestors.map(item => item.id)).toEqual(['root', 'loop'])
  })

  it('treats a missing dependsOn field as no dependencies', () => {
    const tree = decomposeNode(createArticleTree('对照稿'), 'root', [
      { type: 'write', goal: '叶', id: 'leaf' },
    ])
    delete (tree.nodes.leaf as { dependsOn?: string[] }).dependsOn
    const info = getExecuteInfo(tree, 'leaf', { draft: 'draft' })
    expect(info.deps).toEqual([])
  })

  it('caps ancestor depth so a deep chain does not dump the whole spine', () => {
    let tree = createArticleTree('对照稿')
    let parent = 'root'
    for (let i = 1; i <= MAX_ANCESTOR_DEPTH + 2; i++) {
      const id = `n${i}`
      tree = decomposeNode(tree, parent, [{ type: 'write', goal: `层${i}`, id }])
      parent = id
    }
    const info = getExecuteInfo(tree, parent, { draft: '' })
    expect(info.ancestors).toHaveLength(MAX_ANCESTOR_DEPTH)
    expect(info.ancestors[0]?.id).not.toBe('root')
  })
})

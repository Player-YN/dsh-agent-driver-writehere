import {
  childLinkPath,
  clipViewText,
  dependsLinkPath,
  formatWaitsOn,
  layoutHorizontalTree,
  nodeDependsOn,
  viewEdges,
  type ViewTree,
} from './layout.ts'
import css from './ArticleTreeGraph.module.css'

const NODE_W = 168
const NODE_H = 68

export function ArticleTreeGraph({ tree }: { tree: ViewTree }) {
  const layout = layoutHorizontalTree(tree)
  const edges = viewEdges(tree)
  return (
    <svg
      className={css.svg}
      viewBox={`0 0 ${layout.width + 24} ${layout.height}`}
      role="img"
      aria-label={tree.topic}
    >
      {edges.map((edge) => {
        const from = layout.positions[edge.from]
        const to = layout.positions[edge.to]
        if (!from || !to) return null
        return (
          <path
            key={`${edge.kind}-${edge.from}-${edge.to}`}
            data-edge={edge.kind}
            data-from={edge.from}
            data-to={edge.to}
            className={edge.kind === 'child' ? css.edge : css.depEdge}
            d={edge.kind === 'child' ? childLinkPath(from, to) : dependsLinkPath(from, to)}
          />
        )
      })}
      {Object.values(tree.nodes).map((node) => {
        const pos = layout.positions[node.id]
        if (!pos) return null
        const deps = nodeDependsOn(node)
        const waits = formatWaitsOn(deps)
        return (
          <g
            key={node.id}
            className={`${css.node} ${css[node.type]} ${css[node.status]}`}
            data-node-id={node.id}
            data-x={pos.x}
            data-y={pos.y}
            data-waits-on={deps.join(',')}
            transform={`translate(${pos.x},${pos.y})`}
          >
            <rect className={css.box} x={-NODE_W / 2} y={-NODE_H / 2} width={NODE_W} height={NODE_H} rx={8} />
            <text className={css.kind} x={-NODE_W / 2 + 8} y={-14}>
              {clipViewText(`${node.type.toUpperCase()} · ${node.id}`, 18)}
            </text>
            <text className={css.status} x={NODE_W / 2 - 8} y={-14} textAnchor="end">{node.status}</text>
            <text className={css.goal} x={-NODE_W / 2 + 8} y={6}>{clipViewText(node.goal, 16)}</text>
            <text className={css.waits} x={-NODE_W / 2 + 8} y={22}>{clipViewText(waits ?? '', 22)}</text>
          </g>
        )
      })}
    </svg>
  )
}

import { useMemo } from 'react'
import type { LayoutNode, LayoutEdge } from '@/types/layout'
import { formatAmount } from '@/utils/formatAmount'

interface FlowContextTabProps {
  node: LayoutNode
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  rawNodes: LayoutNode[]
  rawEdges: LayoutEdge[]
}

interface FlowNode {
  node: LayoutNode
  amount: number
}

export function FlowContextTab({ node, rawNodes, rawEdges }: FlowContextTabProps) {
  // 上流ノード（このノードへ流入するエッジの source）
  const upstreamNodes = useMemo((): FlowNode[] => {
    const incomingEdges = rawEdges.filter(e => e.targetId === node.id)
    const sourceIds = new Set(incomingEdges.map(e => e.sourceId))

    return rawNodes
      .filter(n => sourceIds.has(n.id))
      .map(sourceNode => {
        const amount = incomingEdges
          .filter(e => e.sourceId === sourceNode.id)
          .reduce((sum, e) => sum + e.value, 0)
        return { node: sourceNode, amount }
      })
      .filter(f => f.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [node.id, rawNodes, rawEdges])

  // 下流ノード（このノードから流出するエッジの target）
  const downstreamNodes = useMemo((): FlowNode[] => {
    const outgoingEdges = rawEdges.filter(e => e.sourceId === node.id)
    const targetIds = new Set(outgoingEdges.map(e => e.targetId))

    return rawNodes
      .filter(n => targetIds.has(n.id))
      .map(targetNode => {
        const amount = outgoingEdges
          .filter(e => e.targetId === targetNode.id)
          .reduce((sum, e) => sum + e.value, 0)
        return { node: targetNode, amount }
      })
      .filter(f => f.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [node.id, rawNodes, rawEdges])

  // 合計金額
  const upstreamTotal = upstreamNodes.reduce((sum, f) => sum + f.amount, 0)
  const downstreamTotal = downstreamNodes.reduce((sum, f) => sum + f.amount, 0)

  return (
    <div className="space-y-6">
      {/* Upstream section */}
      <FlowSection
        title="上流（予算元）"
        icon="↑"
        nodes={upstreamNodes}
        total={upstreamTotal}
        emptyMessage="上流ノードがありません（最上位）"
      />

      {/* Current node indicator */}
      <div className="flex items-center justify-center">
        <div className="bg-blue-500/20 border border-blue-500 rounded px-4 py-2 max-w-full">
          <p className="text-blue-400 text-sm font-medium truncate">{node.name}</p>
          <p className="text-blue-300/60 text-xs text-center mt-1">
            {formatAmount(node.amount)}
          </p>
        </div>
      </div>

      {/* Downstream section */}
      <FlowSection
        title="下流（支出先）"
        icon="↓"
        nodes={downstreamNodes}
        total={downstreamTotal}
        emptyMessage="下流ノードがありません（最下位）"
      />
    </div>
  )
}

interface FlowSectionProps {
  title: string
  icon: string
  nodes: FlowNode[]
  total: number
  emptyMessage: string
}

function FlowSection({ title, icon, nodes, total, emptyMessage }: FlowSectionProps) {
  if (nodes.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
          <span>{icon}</span>
          <span>{title}</span>
        </h4>
        <div className="text-slate-500 text-center py-4 border border-dashed border-slate-600 rounded">
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
        <span>{icon}</span>
        <span>{title}</span>
        <span className="ml-auto text-slate-600">{nodes.length}件</span>
      </h4>

      {/* Summary */}
      <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">合計</span>
          <span className="text-sm font-semibold text-white">{formatAmount(total)}</span>
        </div>
      </div>

      {/* Node list */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {nodes.map(({ node: flowNode, amount }, index) => {
          const percentage = total > 0 ? (amount / total) * 100 : 0
          return (
            <div
              key={flowNode.id}
              className="bg-slate-700/20 border border-slate-600/30 rounded-lg p-2 hover:bg-slate-700/40 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs text-slate-500 font-medium">#{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <NodeTypeBadge type={flowNode.type} layer={flowNode.layer} />
                    <p className="text-sm text-white truncate flex-1">{flowNode.name}</p>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-blue-300">{formatAmount(amount)}</span>
                    <span className="text-xs text-slate-500">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NodeTypeBadge({ type, layer }: { type: string; layer: number }) {
  const labels: Record<string, string> = {
    ministry: '府省',
    bureau: '局',
    division: '課',
    project: '事業',
    recipient: '支出先',
  }

  const colorClasses: Record<number, string> = {
    0: 'bg-cyan-600/50 text-cyan-200',
    1: 'bg-blue-600/50 text-blue-200',
    2: 'bg-green-600/50 text-green-200',
    3: 'bg-yellow-600/50 text-yellow-200',
    4: 'bg-red-600/50 text-red-200',
  }

  return (
    <span className={`text-[10px] px-1 py-0.5 rounded ${colorClasses[layer] || 'bg-slate-600 text-slate-200'}`}>
      {labels[type] || type}
    </span>
  )
}

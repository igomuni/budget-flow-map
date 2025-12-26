import { useMemo } from 'react'
import type { LayoutNode, LayoutEdge } from '@/types/layout'
import { formatAmount } from '@/utils/formatAmount'

interface ProjectsTabProps {
  node: LayoutNode
  edges: LayoutEdge[]
  nodes: LayoutNode[]
}

interface ProjectWithAmount {
  node: LayoutNode
  amount: number // エッジの実際の支出金額（事業予算ではない）
}

export function ProjectsTab({ node, edges, nodes }: ProjectsTabProps) {
  // この支出先への入エッジを辿って、事業ノードとその支出金額を集計
  const projects = useMemo((): ProjectWithAmount[] => {
    // 支出先ノード以外は空配列を返す
    if (node.type !== 'recipient') {
      return []
    }
    const projectMap = new Map<string, number>() // projectId -> 累積支出金額

    // この支出先への直接の入エッジを取得
    const incomingEdges = edges.filter(edge => edge.targetId === node.id)

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find(n => n.id === edge.sourceId)
      if (!sourceNode) continue

      // 事業ノードなら記録
      if (sourceNode.type === 'project') {
        const currentAmount = projectMap.get(sourceNode.id) || 0
        projectMap.set(sourceNode.id, currentAmount + edge.value)
      }
    }

    // 「その他の支出先」ノードを経由している場合の処理
    // この支出先が「その他の支出先」ノードに集約されている可能性がある
    // その場合、「その他の支出先」ノードへの入エッジから事業を探索
    const otherRecipientNodes = nodes.filter(
      n => n.type === 'recipient' &&
           n.metadata.isOther &&
           n.metadata.aggregatedIds?.includes(node.id)
    )

    for (const otherNode of otherRecipientNodes) {
      const otherIncomingEdges = edges.filter(edge => edge.targetId === otherNode.id)

      for (const edge of otherIncomingEdges) {
        const sourceNode = nodes.find(n => n.id === edge.sourceId)
        if (!sourceNode) continue

        if (sourceNode.type === 'project') {
          const currentAmount = projectMap.get(sourceNode.id) || 0
          // 「その他」ノードへのエッジ金額を、集約された支出先数で均等配分
          const aggregatedCount = otherNode.metadata.aggregatedIds?.length || 1
          const perRecipientAmount = edge.value / aggregatedCount
          projectMap.set(sourceNode.id, currentAmount + perRecipientAmount)
        }
      }
    }

    // Map を配列に変換
    const projectList: ProjectWithAmount[] = []
    for (const [projectId, amount] of projectMap.entries()) {
      const projectNode = nodes.find(n => n.id === projectId)
      if (projectNode && projectNode.type === 'project') {
        projectList.push({
          node: projectNode,
          amount // エッジの実際の支出金額（事業予算ではない）
        })
      }
    }

    // 金額降順でソート
    return projectList.sort((a, b) => b.amount - a.amount)
  }, [node.id, node.type, edges, nodes])

  if (node.type !== 'recipient') {
    return (
      <div className="text-slate-400 text-center py-8">
        <p>事業タブは支出先ノードでのみ表示されます</p>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="text-slate-400 text-center py-8">
        <p className="text-sm">この支出先への事業データがありません</p>
      </div>
    )
  }

  // 合計金額
  const totalAmount = projects.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">関連事業数</span>
          <span className="text-lg font-semibold text-white">{projects.length.toLocaleString()}件</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-slate-400">合計支出額</span>
          <span className="text-lg font-semibold text-white">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {/* Note about zero-budget projects */}
      {projects.some(p => p.node.amount === 0 && p.amount > 0) && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3">
          <p className="text-xs text-yellow-300">
            💡 事業予算が0円でも支出金額がある場合があります
          </p>
        </div>
      )}

      {/* Projects list */}
      <div>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          事業一覧
        </h3>
        <div className="space-y-2">
          {projects.map(({ node: projectNode, amount }, index) => {
            const percentage = (amount / totalAmount) * 100
            const isZeroBudget = projectNode.amount === 0 && amount > 0

            return (
              <div
                key={projectNode.id}
                className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
              >
                {/* Rank and name */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 mt-0.5">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {projectNode.name}
                      {isZeroBudget && (
                        <span className="ml-2 text-[10px] text-yellow-400" title="事業予算0円">
                          ⚠️ 予算0円
                        </span>
                      )}
                    </p>
                    {projectNode.ministryId && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {projectNode.ministryId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amounts */}
                <div className="space-y-1 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">この支出先への支出</span>
                    <span className="text-sm font-semibold text-blue-300">
                      {formatAmount(amount)}
                    </span>
                  </div>
                  {projectNode.amount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">事業予算総額</span>
                      <span className="text-xs text-slate-500">
                        {formatAmount(projectNode.amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">構成比</span>
                    <span className="text-xs text-slate-400">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-600 rounded-full h-1.5">
                  <div
                    className="bg-yellow-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

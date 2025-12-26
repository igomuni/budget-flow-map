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
  // この支出先に支出している事業を集計（シンプルフィルタリング）
  const projects = useMemo((): ProjectWithAmount[] => {
    // 支出先ノード以外は空配列を返す
    if (node.type !== 'recipient') {
      return []
    }

    // 全事業（「その他」を除く）から、この支出先へのエッジを探す
    const allProjects = nodes.filter(n =>
      n.type === 'project' &&
      !n.metadata.isOther
    )

    return allProjects
      .map(project => {
        // この事業からの直接エッジ
        const directAmount = edges
          .filter(e => e.sourceId === project.id && e.targetId === node.id)
          .reduce((sum, e) => sum + e.value, 0)

        // 「その他の支出先」経由のエッジ
        const otherRecipientAmount = edges
          .filter(e => {
            if (e.sourceId !== project.id) return false
            const target = nodes.find(n => n.id === e.targetId)
            return target?.type === 'recipient' &&
                   target.metadata.isOther &&
                   target.metadata.aggregatedIds?.includes(node.id)
          })
          .reduce((sum, e) => {
            const target = nodes.find(n => n.id === e.targetId)!
            const count = target.metadata.aggregatedIds?.length || 1
            return sum + (e.value / count) // 均等配分
          }, 0)

        return {
          node: project,
          amount: directAmount + otherRecipientAmount
        }
      })
      .filter(p => p.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [node.id, node.type, nodes, edges])

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

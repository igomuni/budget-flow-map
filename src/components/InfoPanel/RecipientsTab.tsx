import { useMemo } from 'react'
import type { LayoutNode, LayoutEdge } from '@/types/layout'
import { formatAmount } from '@/utils/formatAmount'

interface RecipientsTabProps {
  node: LayoutNode
  edges: LayoutEdge[]
  nodes: LayoutNode[]
}

interface RecipientWithAmount {
  node: LayoutNode
  amount: number
}

export function RecipientsTab({ node, edges, nodes }: RecipientsTabProps) {
  // この事業から支出先への接続を検索
  const recipients = useMemo((): RecipientWithAmount[] => {
    // 事業ノード以外は空配列を返す
    if (node.type !== 'project') {
      return []
    }

    // この事業ノードからの出エッジを取得
    const outgoingEdges = edges.filter(edge => edge.sourceId === node.id)

    // エッジから支出先ノードと金額を取得
    const recipientList: RecipientWithAmount[] = []
    for (const edge of outgoingEdges) {
      const recipientNode = nodes.find(n => n.id === edge.targetId)
      if (recipientNode && recipientNode.type === 'recipient') {
        recipientList.push({
          node: recipientNode,
          amount: edge.value
        })
      }
    }

    // 金額降順でソート
    return recipientList.sort((a, b) => b.amount - a.amount)
  }, [node.id, node.type, edges, nodes])

  // 事業ノード以外は表示しない
  if (node.type !== 'project') {
    return (
      <div className="text-slate-400 text-center py-8">
        <p>支出先情報は事業ノードでのみ表示されます</p>
      </div>
    )
  }

  if (recipients.length === 0) {
    return (
      <div className="text-slate-400 text-center py-8">
        <p className="text-sm">この事業には支出先データがありません</p>
      </div>
    )
  }

  // 合計金額
  const totalAmount = recipients.reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">支出先総数</span>
          <span className="text-lg font-semibold text-white">{recipients.length.toLocaleString()}件</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-slate-400">合計支出額</span>
          <span className="text-lg font-semibold text-white">{formatAmount(totalAmount)}</span>
        </div>
      </div>

      {/* Recipients list */}
      <div>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          支出先一覧
        </h3>
        <div className="space-y-2">
          {recipients.map(({ node: recipientNode, amount }, index) => {
            const percentage = (amount / totalAmount) * 100
            return (
              <div
                key={recipientNode.id}
                className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
              >
                {/* Rank and name */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-medium text-slate-500 mt-0.5">#{index + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {recipientNode.name}
                    </p>
                    {recipientNode.metadata.corporateType && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {recipientNode.metadata.corporateType}
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount and percentage */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-300">
                    {formatAmount(amount)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {percentage.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-600 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>

                {/* Additional info */}
                {recipientNode.metadata.location && (
                  <p className="text-xs text-slate-500 mt-2 truncate">
                    📍 {recipientNode.metadata.location}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Note about multiple ministries */}
      {recipients.some(r => r.node.metadata.sourceMinistries && r.node.metadata.sourceMinistries.length > 1) && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
          <p className="text-xs text-blue-300">
            💡 一部の支出先は複数の府省庁から支出を受けています
          </p>
        </div>
      )}
    </div>
  )
}

import { useMemo } from 'react'
import type { LayoutNode, LayoutEdge } from '@/types/layout'
import { formatAmount } from '@/utils/formatAmount'

interface RecipientsTabProps {
  node: LayoutNode
  edges: LayoutEdge[]
  nodes: LayoutNode[]
  rawNodes: LayoutNode[]
  rawEdges: LayoutEdge[]
}

interface RecipientWithAmount {
  node: LayoutNode
  amount: number
}

export function RecipientsTab({ node, rawNodes, rawEdges }: RecipientsTabProps) {
  // 全支出先の総額ランキングを計算（TopN判定用）
  const globalRecipientRanking = useMemo(() => {
    const allRecipients = rawNodes
      .filter(n => n.type === 'recipient')
      .sort((a, b) => b.amount - a.amount)

    const rankMap = new Map<string, number>()
    allRecipients.forEach((recipient, index) => {
      rankMap.set(recipient.id, index + 1)
    })
    return rankMap
  }, [rawNodes])

  // このノードに関連する支出先を取得（元データから直接フィルタ）
  const recipients = useMemo((): RecipientWithAmount[] => {
    // 支出先ノード自体は表示しない
    if (node.type === 'recipient') {
      return []
    }

    // 選択ノードの府省庁IDを取得
    const targetMinistryId = node.ministryId
    if (!targetMinistryId) {
      return []
    }

    // 元データから、この府省庁に関連する全支出先を取得
    const allRecipients = rawNodes.filter(n =>
      n.type === 'recipient' &&
      n.metadata.sourceMinistries?.includes(targetMinistryId)
    )

    // 各支出先の金額を元データのエッジから計算
    return allRecipients
      .map(recipient => {
        // この支出先への全入エッジの合計金額（元データから）
        const totalAmount = rawEdges
          .filter(e => e.targetId === recipient.id)
          .reduce((sum, e) => sum + e.value, 0)

        return { node: recipient, amount: totalAmount }
      })
      .filter(r => r.amount > 0) // 金額がある支出先のみ
      .sort((a, b) => b.amount - a.amount)
  }, [node.type, node.ministryId, rawNodes, rawEdges])

  // 支出先ノード自体は表示しない
  if (node.type === 'recipient') {
    return (
      <div className="text-slate-400 text-center py-8">
        <p>支出先ノード自体には支出先タブは表示されません</p>
      </div>
    )
  }

  if (recipients.length === 0) {
    return (
      <div className="text-slate-400 text-center py-8">
        <p className="text-sm">このノードには支出先データがありません</p>
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
            const globalRank = globalRecipientRanking.get(recipientNode.id)
            return (
              <div
                key={recipientNode.id}
                className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
              >
                {/* Rank and name */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-medium text-slate-500">#{index + 1}</span>
                    {globalRank && (
                      <span className="text-[10px] text-slate-600" title="全体順位">
                        (Top{globalRank})
                      </span>
                    )}
                  </div>
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

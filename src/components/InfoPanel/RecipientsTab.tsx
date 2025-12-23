import type { LayoutNode } from '@/types/layout'

interface RecipientsTabProps {
  node: LayoutNode
}

export function RecipientsTab({ node }: RecipientsTabProps) {
  // This tab will show related recipients for project nodes
  // For now, show placeholder content

  if (node.type !== 'project') {
    return (
      <div className="text-slate-400 text-center py-8">
        <p>支出先情報は事業ノードでのみ表示されます</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        この事業に関連する支出先の一覧
      </p>

      {/* Placeholder - will be populated when we have edge data accessible */}
      <div className="text-slate-500 text-center py-8 border border-dashed border-slate-600 rounded">
        <p className="text-sm">支出先データを読み込み中...</p>
        <p className="text-xs mt-2">
          (実装予定: レイアウトデータから接続された支出先ノードを表示)
        </p>
      </div>
    </div>
  )
}

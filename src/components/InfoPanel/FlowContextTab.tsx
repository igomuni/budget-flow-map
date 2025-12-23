import type { LayoutNode } from '@/types/layout'

interface FlowContextTabProps {
  node: LayoutNode
}

export function FlowContextTab({ node }: FlowContextTabProps) {
  // This tab will show upstream and downstream flow context
  // For now, show placeholder content

  return (
    <div className="space-y-6">
      {/* Upstream */}
      <div>
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          上流（予算元）
        </h4>
        <div className="text-slate-500 text-center py-4 border border-dashed border-slate-600 rounded">
          <p className="text-sm">上流ノードを表示予定</p>
        </div>
      </div>

      {/* Current node indicator */}
      <div className="flex items-center justify-center">
        <div className="bg-blue-500/20 border border-blue-500 rounded px-4 py-2">
          <p className="text-blue-400 text-sm font-medium">{node.name}</p>
        </div>
      </div>

      {/* Downstream */}
      <div>
        <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
          下流（支出先）
        </h4>
        <div className="text-slate-500 text-center py-4 border border-dashed border-slate-600 rounded">
          <p className="text-sm">下流ノードを表示予定</p>
        </div>
      </div>

      <p className="text-slate-600 text-xs text-center">
        (実装予定: 選択ノードを中心としたフローの可視化)
      </p>
    </div>
  )
}

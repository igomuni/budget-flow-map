import type { LayoutNode } from '@/types/layout'
import { formatAmount, formatRate } from '@/utils/formatAmount'

interface BasicInfoTabProps {
  node: LayoutNode
}

export function BasicInfoTab({ node }: BasicInfoTabProps) {
  return (
    <div className="space-y-4">
      {/* Amount */}
      <InfoSection title="金額">
        <p className="text-2xl font-bold text-white">{formatAmount(node.amount)}</p>
      </InfoSection>

      {/* Ministry */}
      {node.ministryId && (
        <InfoSection title="所管府省">
          <p className="text-slate-200">{node.ministryId}</p>
        </InfoSection>
      )}

      {/* Hierarchy path */}
      {node.metadata.hierarchyPath && node.metadata.hierarchyPath.length > 0 && (
        <InfoSection title="階層">
          <div className="text-sm text-slate-300 space-y-1">
            {node.metadata.hierarchyPath.map((path, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <span className="text-slate-500 mr-2">→</span>}
                <span>{path}</span>
              </div>
            ))}
          </div>
        </InfoSection>
      )}

      {/* Execution rate (for projects) */}
      {node.metadata.executionRate !== undefined && (
        <InfoSection title="執行率">
          <div className="flex items-center">
            <div className="flex-1 bg-slate-700 rounded-full h-2 mr-3">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${Math.min(node.metadata.executionRate * 100, 100)}%` }}
              />
            </div>
            <span className="text-slate-200">{formatRate(node.metadata.executionRate)}</span>
          </div>
        </InfoSection>
      )}

      {/* Corporate info (for recipients) */}
      {node.metadata.corporateNumber && (
        <InfoSection title="法人番号">
          <p className="text-slate-300 font-mono">{node.metadata.corporateNumber}</p>
        </InfoSection>
      )}

      {node.metadata.location && (
        <InfoSection title="所在地">
          <p className="text-slate-300">{node.metadata.location}</p>
        </InfoSection>
      )}

      {node.metadata.corporateType && (
        <InfoSection title="法人種別">
          <p className="text-slate-300">{node.metadata.corporateType}</p>
        </InfoSection>
      )}

      {/* Node type and layer info */}
      <InfoSection title="ノード情報">
        <div className="text-sm text-slate-400 space-y-1">
          <p>タイプ: {getNodeTypeLabel(node.type)}</p>
          <p>レイヤー: {node.layer}</p>
          <p>ID: <span className="font-mono text-xs">{node.id}</span></p>
        </div>
      </InfoSection>
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {title}
      </h3>
      {children}
    </div>
  )
}

function getNodeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    ministry: '府省',
    bureau: '局',
    division: '課',
    project: '事業',
    recipient: '支出先',
  }
  return labels[type] || type
}

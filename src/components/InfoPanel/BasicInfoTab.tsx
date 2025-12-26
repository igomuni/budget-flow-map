import type { LayoutNode } from '@/types/layout'
import { formatAmount, formatRate } from '@/utils/formatAmount'

interface BasicInfoTabProps {
  node: LayoutNode
}

export function BasicInfoTab({ node }: BasicInfoTabProps) {
  // ノードタイプに応じて表示を分岐
  if (node.type === 'recipient') {
    return <RecipientInfo node={node} />
  }
  if (node.type === 'project') {
    return <ProjectInfo node={node} />
  }
  return <OrganizationInfo node={node} />
}

// 支出先（recipient）用の情報表示
function RecipientInfo({ node }: { node: LayoutNode }) {
  return (
    <div className="space-y-4">
      {/* Amount */}
      <InfoSection title="受取総額">
        <p className="text-2xl font-bold text-white">{formatAmount(node.amount)}</p>
        <p className="text-xs text-slate-500 mt-1">※ 表示中のデータからの合計</p>
      </InfoSection>

      {/* Corporate info */}
      {node.metadata.corporateNumber && (
        <InfoSection title="法人番号">
          <a
            href={`https://www.houjin-bangou.nta.go.jp/henkorireki-johoto.html?selHouzinNo=${node.metadata.corporateNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 font-mono hover:underline"
          >
            {node.metadata.corporateNumber}
          </a>
        </InfoSection>
      )}

      {node.metadata.corporateType && (
        <InfoSection title="種別">
          <p className="text-slate-200">{node.metadata.corporateType}</p>
        </InfoSection>
      )}

      {node.metadata.location && (
        <InfoSection title="所在地">
          <p className="text-slate-200">{node.metadata.location}</p>
        </InfoSection>
      )}

      {/* Connected ministries */}
      {node.metadata.sourceMinistries && node.metadata.sourceMinistries.length > 0 ? (
        <InfoSection title="支出元府省">
          <ul className="text-slate-200 space-y-1">
            {node.metadata.sourceMinistries.map((ministry, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-slate-500">・</span>
                <span>{ministry}</span>
              </li>
            ))}
          </ul>
        </InfoSection>
      ) : node.ministryId ? (
        <InfoSection title="支出元府省">
          <p className="text-slate-200">{node.ministryId}</p>
        </InfoSection>
      ) : null}

      {/* Node metadata */}
      <InfoSection title="データ情報">
        <div className="text-sm text-slate-400 space-y-1">
          <p>ID: <span className="font-mono text-xs">{node.id}</span></p>
        </div>
      </InfoSection>
    </div>
  )
}

// 事業（project）用の情報表示
function ProjectInfo({ node }: { node: LayoutNode }) {
  return (
    <div className="space-y-4">
      {/* Amount */}
      <InfoSection title="予算額">
        <p className="text-2xl font-bold text-white">{formatAmount(node.amount)}</p>
      </InfoSection>

      {/* Execution rate */}
      {node.metadata.executionRate !== undefined && (
        <InfoSection title="執行率">
          <div className="flex items-center">
            <div className="flex-1 bg-slate-700 rounded-full h-3 mr-3">
              <div
                className={`h-3 rounded-full ${
                  node.metadata.executionRate >= 0.9 ? 'bg-green-500' :
                  node.metadata.executionRate >= 0.7 ? 'bg-blue-500' :
                  node.metadata.executionRate >= 0.5 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(node.metadata.executionRate * 100, 100)}%` }}
              />
            </div>
            <span className="text-slate-200 font-medium">{formatRate(node.metadata.executionRate)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {node.metadata.executionRate >= 0.9 ? '順調に執行' :
             node.metadata.executionRate >= 0.7 ? '概ね順調' :
             node.metadata.executionRate >= 0.5 ? '執行中' :
             '執行率低め'}
          </p>
        </InfoSection>
      )}

      {/* Ministry */}
      {node.ministryId && (
        <InfoSection title="所管府省">
          <p className="text-slate-200">{node.ministryId}</p>
        </InfoSection>
      )}

      {/* Node metadata */}
      <InfoSection title="データ情報">
        <div className="text-sm text-slate-400 space-y-1">
          <p>ID: <span className="font-mono text-xs">{node.id}</span></p>
        </div>
      </InfoSection>
    </div>
  )
}

// 組織（府省・局・課）用の情報表示
function OrganizationInfo({ node }: { node: LayoutNode }) {
  const typeLabel = getNodeTypeLabel(node.type)

  return (
    <div className="space-y-4">
      {/* Amount */}
      <InfoSection title="予算総額">
        <p className="text-2xl font-bold text-white">{formatAmount(node.amount)}</p>
      </InfoSection>

      {/* Ministry (for bureau/division) */}
      {node.ministryId && node.type !== 'ministry' && (
        <InfoSection title="所管府省">
          <p className="text-slate-200">{node.ministryId}</p>
        </InfoSection>
      )}

      {/* Node metadata */}
      <InfoSection title="データ情報">
        <div className="text-sm text-slate-400 space-y-1">
          <p>タイプ: {typeLabel}</p>
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

import { useStore } from '@/store'
import { BasicInfoTab } from './BasicInfoTab'
import { RecipientsTab } from './RecipientsTab'
import { FlowContextTab } from './FlowContextTab'
import type { InfoPanelTab } from '@/types/store'

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={`flex-1 py-3 text-sm font-medium transition-colors ${
        active
          ? 'text-blue-400 border-b-2 border-blue-400'
          : 'text-slate-400 hover:text-slate-200'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function InfoPanel() {
  const isOpen = useStore((state) => state.isInfoPanelOpen)
  const selectedNode = useStore((state) => state.selectedNodeData)
  const activeTab = useStore((state) => state.activeTab)
  const setActiveTab = useStore((state) => state.setActiveTab)
  const clearSelection = useStore((state) => state.clearSelection)

  if (!isOpen || !selectedNode) return null

  const tabs: { key: InfoPanelTab; label: string }[] = [
    { key: 'basic', label: '基本情報' },
    { key: 'recipients', label: '支出先' },
    { key: 'flow', label: 'フロー' },
  ]

  return (
    <aside className="w-96 h-full bg-slate-800 shadow-lg flex flex-col z-10 border-r border-slate-700">
      {/* Header with close button */}
      <header className="p-4 border-b border-slate-700 flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-white truncate">
            {selectedNode.name}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {getNodeTypeLabel(selectedNode.type)}
          </p>
        </div>
        <button
          onClick={clearSelection}
          className="ml-2 p-1 text-slate-400 hover:text-white transition-colors"
          aria-label="閉じる"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Tab navigation */}
      <nav className="flex border-b border-slate-700">
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            active={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </TabButton>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'basic' && <BasicInfoTab node={selectedNode} />}
        {activeTab === 'recipients' && <RecipientsTab node={selectedNode} />}
        {activeTab === 'flow' && <FlowContextTab node={selectedNode} />}
      </div>
    </aside>
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

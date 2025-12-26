import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { BasicInfoTab } from './InfoPanel/BasicInfoTab'
import { RecipientsTab } from './InfoPanel/RecipientsTab'
import { ProjectsTab } from './InfoPanel/ProjectsTab'
import { FlowContextTab } from './InfoPanel/FlowContextTab'
import type { LayoutNode, LayoutEdge } from '@/types/layout'
import type { InfoPanelTab } from '@/types/store'

interface SidePanelProps {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  rawNodes: LayoutNode[]
  rawEdges: LayoutEdge[]
  onNodeSelect: (node: LayoutNode) => void
}

export function SidePanel({ nodes, edges, rawNodes, rawEdges, onNodeSelect }: SidePanelProps) {
  const selectedNode = useStore((state) => state.selectedNodeData)
  const activeTab = useStore((state) => state.activeTab)
  const setActiveTab = useStore((state) => state.setActiveTab)
  const clearSelection = useStore((state) => state.clearSelection)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchHistory, setSearchHistory] = useState<LayoutNode[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter nodes by query
  const searchResults = useMemo(() => {
    if (!query.trim()) return []

    const lowerQuery = query.toLowerCase()
    const results = nodes
      .filter(node => node.name.toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        // Exact match first
        const aExact = a.name.toLowerCase() === lowerQuery
        const bExact = b.name.toLowerCase() === lowerQuery
        if (aExact && !bExact) return -1
        if (!aExact && bExact) return 1

        // Starts with query
        const aStarts = a.name.toLowerCase().startsWith(lowerQuery)
        const bStarts = b.name.toLowerCase().startsWith(lowerQuery)
        if (aStarts && !bStarts) return -1
        if (!aStarts && bStarts) return 1

        // By amount (descending)
        return b.amount - a.amount
      })
      .slice(0, 50) // Limit to 50 results

    return results
  }, [nodes, query])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchResults])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && searchResults.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, searchResults])

  // Global keyboard shortcut (Cmd+K / Ctrl+K) to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Handle node selection (search result or history click)
  const handleNodeSelect = useCallback((node: LayoutNode) => {
    onNodeSelect(node)
    setQuery('')
    // Add to history (remove duplicates, keep latest at top)
    setSearchHistory(prev => {
      const filtered = prev.filter(n => n.id !== node.id)
      return [node, ...filtered].slice(0, 10) // Keep last 10
    })
  }, [onNodeSelect])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // IME入力中（日本語変換中）はキー操作を無視
    if (e.nativeEvent.isComposing) {
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      e.preventDefault()
      const node = searchResults[selectedIndex]
      handleNodeSelect(node)
    } else if (e.key === 'Escape') {
      setQuery('')
      inputRef.current?.blur()
    }
  }, [searchResults, selectedIndex, handleNodeSelect])

  // Format amount for display
  const formatAmount = (amount: number): string => {
    if (amount >= 1e12) return `${(amount / 1e12).toFixed(2)}兆円`
    if (amount >= 1e8) return `${(amount / 1e8).toFixed(2)}億円`
    if (amount >= 1e4) return `${(amount / 1e4).toFixed(0)}万円`
    return `${amount.toLocaleString()}円`
  }

  // Get layer name
  const getLayerName = (layer: number): string => {
    const names = ['府省', '局', '課', '事業', '支出先']
    return names[layer] || ''
  }

  // タブ構成：支出先ノードの場合は「事業」タブ、それ以外は「支出先」タブ
  const tabs: { key: InfoPanelTab; label: string }[] = useMemo(() => {
    if (selectedNode?.type === 'recipient') {
      return [
        { key: 'basic', label: '基本情報' },
        { key: 'recipients', label: '事業' }, // recipients tabキーを再利用して「事業」を表示
        { key: 'flow', label: 'フロー' },
      ]
    }
    return [
      { key: 'basic', label: '基本情報' },
      { key: 'recipients', label: '支出先' },
      { key: 'flow', label: 'フロー' },
    ]
  }, [selectedNode?.type])

  return (
    <aside className="w-96 h-full bg-slate-800 shadow-lg flex flex-col z-10 border-r border-slate-700 shrink-0">
      {/* Search bar - always visible */}
      <div className="p-3 border-b border-slate-700">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ノード名で検索... (⌘K)"
            className="w-full bg-slate-700 text-white pl-10 pr-10 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search results (when query exists) */}
      {query.trim() && (
        <div ref={listRef} className="overflow-y-auto flex-1 border-b border-slate-700">
          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-sm">
              「{query}」に一致するノードが見つかりません
            </div>
          ) : (
            <>
              {searchResults.map((node, index) => (
                <button
                  key={node.id}
                  onClick={() => handleNodeSelect(node)}
                  className={`w-full px-4 py-3 text-left hover:bg-slate-700 flex flex-col gap-1 border-b border-slate-700/50 ${
                    index === selectedIndex ? 'bg-slate-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      node.layer === 0 ? 'bg-cyan-600/50 text-cyan-200' :
                      node.layer === 1 ? 'bg-blue-600/50 text-blue-200' :
                      node.layer === 2 ? 'bg-green-600/50 text-green-200' :
                      node.layer === 3 ? 'bg-yellow-600/50 text-yellow-200' :
                      'bg-red-600/50 text-red-200'
                    }`}>
                      {getLayerName(node.layer)}
                    </span>
                    <span className="text-white text-sm truncate flex-1">{node.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{formatAmount(node.amount)}</span>
                    {node.ministryId && node.layer > 0 && (
                      <span className="truncate">・{node.ministryId}</span>
                    )}
                  </div>
                </button>
              ))}
              <div className="p-2 text-xs text-slate-500 flex items-center justify-between">
                <span>↑↓ 選択 Enter 決定 Esc 閉じる</span>
                <span>{searchResults.length}件</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Node details (when selected and not searching) */}
      {selectedNode && !query.trim() && (
        <>
          {/* Header with close button */}
          <header className="p-4 border-b border-slate-700 flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white truncate">
                {selectedNode.name}
              </h2>
              {/* Hierarchy path or corporate type */}
              {selectedNode.type === 'recipient' ? (
                <p className="text-sm text-slate-400 mt-1">
                  {selectedNode.metadata.corporateType || '分類なし'}
                </p>
              ) : selectedNode.metadata.hierarchyPath && selectedNode.metadata.hierarchyPath.length > 0 ? (
                <p className="text-sm text-slate-400 mt-1">
                  {selectedNode.metadata.hierarchyPath.map((path, index) => (
                    <span key={index}>
                      {index > 0 && <span className="mx-1">→</span>}
                      <span>{path}</span>
                    </span>
                  ))}
                </p>
              ) : null}
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
              <button
                key={tab.key}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'basic' && <BasicInfoTab node={selectedNode} />}
            {activeTab === 'recipients' && (
              selectedNode.type === 'recipient' ? (
                <ProjectsTab node={selectedNode} edges={edges} nodes={nodes} rawNodes={rawNodes} rawEdges={rawEdges} />
              ) : (
                <RecipientsTab node={selectedNode} edges={edges} nodes={nodes} rawNodes={rawNodes} rawEdges={rawEdges} />
              )
            )}
            {activeTab === 'flow' && <FlowContextTab node={selectedNode} />}
          </div>
        </>
      )}

      {/* Search history (when no query and no selection) */}
      {!query.trim() && !selectedNode && searchHistory.length > 0 && (
        <div className="flex-1 overflow-auto">
          <div className="p-3 text-xs text-slate-500 border-b border-slate-700">
            最近の検索
          </div>
          {searchHistory.map((node) => (
            <button
              key={node.id}
              onClick={() => handleNodeSelect(node)}
              className="w-full px-4 py-3 text-left hover:bg-slate-700 flex flex-col gap-1 border-b border-slate-700/50"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  node.layer === 0 ? 'bg-cyan-600/50 text-cyan-200' :
                  node.layer === 1 ? 'bg-blue-600/50 text-blue-200' :
                  node.layer === 2 ? 'bg-green-600/50 text-green-200' :
                  node.layer === 3 ? 'bg-yellow-600/50 text-yellow-200' :
                  'bg-red-600/50 text-red-200'
                }`}>
                  {getLayerName(node.layer)}
                </span>
                <span className="text-white text-sm truncate flex-1">{node.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{formatAmount(node.amount)}</span>
                {node.ministryId && node.layer > 0 && (
                  <span className="truncate">・{node.ministryId}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty state (no query, no selection, no history) */}
      {!query.trim() && !selectedNode && searchHistory.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">ノードを検索するか、</p>
            <p className="text-sm">マップ上でクリックして選択</p>
          </div>
        </div>
      )}
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

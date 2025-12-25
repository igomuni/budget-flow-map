import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { LayoutNode } from '@/types/layout'

interface SearchPanelProps {
  nodes: LayoutNode[]
  onNodeSelect: (nodeId: string, x: number, y: number) => void
}

export function SearchPanel({ nodes, onNodeSelect }: SearchPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
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

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Global keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev)
        if (!isOpen) {
          setQuery('')
        }
      }
      // Also close on Escape when open
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      e.preventDefault()
      const node = searchResults[selectedIndex]
      onNodeSelect(node.id, node.x, node.y)
      setIsOpen(false)
      setQuery('')
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setQuery('')
    }
  }, [searchResults, selectedIndex, onNodeSelect])

  // Handle result click
  const handleResultClick = useCallback((node: LayoutNode) => {
    onNodeSelect(node.id, node.x, node.y)
    setIsOpen(false)
    setQuery('')
  }, [onNodeSelect])

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

  return (
    <div className="absolute top-4 left-4 z-20">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-800/90 hover:bg-slate-700/90 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur-sm border border-slate-600/50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="text-sm">検索</span>
          <span className="text-xs text-slate-400 ml-2">⌘K</span>
        </button>
      ) : (
        <div className="bg-slate-800/95 rounded-lg shadow-xl backdrop-blur-sm border border-slate-600/50 w-96 max-h-[70vh] flex flex-col">
          {/* Search input */}
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
                placeholder="ノード名で検索..."
                className="w-full bg-slate-700 text-white pl-10 pr-10 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => {
                  setIsOpen(false)
                  setQuery('')
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search results */}
          <div ref={listRef} className="overflow-y-auto flex-1">
            {query.trim() && searchResults.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm">
                「{query}」に一致するノードが見つかりません
              </div>
            ) : (
              searchResults.map((node, index) => (
                <button
                  key={node.id}
                  onClick={() => handleResultClick(node)}
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
              ))
            )}
          </div>

          {/* Footer hint */}
          {searchResults.length > 0 && (
            <div className="p-2 border-t border-slate-700 text-xs text-slate-500 flex items-center justify-between">
              <span>↑↓ 選択　Enter 決定　Esc 閉じる</span>
              <span>{searchResults.length}件</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

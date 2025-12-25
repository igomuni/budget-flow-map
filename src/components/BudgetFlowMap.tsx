import { useState, useCallback, useMemo } from 'react'
import type { OrthographicViewState } from '@deck.gl/core'
import { useLayoutData } from '@/hooks/useLayoutData'
import { useDynamicTopN } from '@/hooks/useDynamicTopN'
import { useUrlState } from '@/hooks/useUrlState'
import { DeckGLCanvas } from './DeckGLCanvas'
import { Minimap } from './Minimap'
import { MapControls } from './MapControls'
import { TopNSettings } from './TopNSettings'
import { SearchPanel } from './SearchPanel'
import { generateSankeyPath } from '@/utils/sankeyPath'
import type { LayoutData } from '@/types/layout'

export function BudgetFlowMap() {
  const { data: rawData, loading, error } = useLayoutData()
  const [viewState, setViewState] = useState<OrthographicViewState | null>(null)
  const [navigateTarget, setNavigateTarget] = useState<[number, number] | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [nodeSpacingX, setNodeSpacingX] = useState(0) // px単位
  const [nodeSpacingY, setNodeSpacingY] = useState(0) // px単位
  const [nodeWidth, setNodeWidth] = useState(50) // px単位
  const [topProjects, setTopProjects] = useState(500)
  const [topRecipients, setTopRecipients] = useState(1000)
  const [threshold, setThreshold] = useState(1e12) // 1兆円 = 1,000,000,000,000円

  // 動的TopNフィルタリングを適用
  const data = useDynamicTopN(rawData, { topProjects, topRecipients, threshold })

  // URL状態同期
  const handleUrlStateChange = useCallback((urlState: {
    x?: number
    y?: number
    zoom?: number
    node?: string
    topProjects?: number
    topRecipients?: number
    threshold?: number
  }) => {
    // Update view state from URL
    if (urlState.x !== undefined && urlState.y !== undefined) {
      setViewState(prev => ({
        ...prev,
        target: [urlState.x!, urlState.y!] as [number, number],
        zoom: urlState.zoom ?? prev?.zoom ?? -4,
        minZoom: -13,
        maxZoom: 6,
      }))
    } else if (urlState.zoom !== undefined) {
      setViewState(prev => ({
        ...prev,
        zoom: urlState.zoom!,
        minZoom: -13,
        maxZoom: 6,
      }))
    }

    // Update selection from URL
    if (urlState.node !== undefined) {
      setSelectedNodeId(urlState.node)
    }

    // Update TopN settings from URL
    if (urlState.topProjects !== undefined) {
      setTopProjects(urlState.topProjects)
    }
    if (urlState.topRecipients !== undefined) {
      setTopRecipients(urlState.topRecipients)
    }
    if (urlState.threshold !== undefined) {
      setThreshold(urlState.threshold)
    }
  }, [])

  // Get current target coordinates from view state
  const currentTarget = viewState?.target as [number, number] | undefined
  const urlZoom = typeof viewState?.zoom === 'number' ? viewState.zoom : undefined

  useUrlState({
    x: currentTarget?.[0],
    y: currentTarget?.[1],
    zoom: urlZoom,
    selectedNodeId,
    topProjects,
    topRecipients,
    threshold,
    onStateChange: handleUrlStateChange,
  })

  // Handle search result selection - navigate to node and select it
  const handleSearchSelect = useCallback((nodeId: string, x: number, y: number) => {
    // Find node in scaled data to get correct position
    setSelectedNodeId(nodeId)
    setNavigateTarget([x, y])
    // Also zoom in to make the node visible
    const currentZoom = typeof viewState?.zoom === 'number' ? viewState.zoom : -4
    setViewState(prev => ({
      ...prev,
      target: [x, y] as [number, number],
      zoom: Math.max(currentZoom, -2), // Zoom in if too far out
      minZoom: -13,
      maxZoom: 6,
    }))
    setTimeout(() => setNavigateTarget(null), 100)
  }, [viewState])

  const handleViewStateChange = useCallback((vs: OrthographicViewState) => {
    setViewState(vs)
  }, [])

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
    setNavigateTarget([x, y])
    // Reset after a tick to allow re-navigation to same spot
    setTimeout(() => setNavigateTarget(null), 100)
  }, [])

  // Handle zoom change from controls
  const handleZoomChange = useCallback((newZoom: number) => {
    setViewState((prev) => {
      if (!prev) return prev
      return { ...prev, zoom: newZoom }
    })
  }, [])

  // Add spacing to layout data (px単位で加算)
  const scaledData = useMemo((): LayoutData | null => {
    if (!data) return null

    // nodeSpacingX/Yはpx単位でノード間に追加する間隔
    // 各レイヤー間にnodeSpacingXを均等に追加（累積ではなく実際の間隔）
    // まず元のX座標からレイヤーごとの基準位置を取得
    const originalLayerX = new Map<number, number>()
    for (const node of data.nodes) {
      if (!originalLayerX.has(node.layer)) {
        originalLayerX.set(node.layer, node.x)
      }
    }

    // レイヤー間の実際の幅を計算（nodeWidth考慮）
    const layerXOffsets = new Map<number, number>()
    layerXOffsets.set(0, 0) // Layer 0は移動なし
    for (let layer = 1; layer <= 4; layer++) {
      // 前のレイヤーのオフセット + nodeSpacingX
      layerXOffsets.set(layer, layerXOffsets.get(layer - 1)! + nodeSpacingX)
    }

    // Y方向は累積的に間隔を追加
    const spacedNodes = data.nodes.map((node, index) => {
      const prevNodes = data.nodes.slice(0, index).filter(n => n.layer === node.layer)
      const yOffset = prevNodes.length * nodeSpacingY

      return {
        ...node,
        x: node.x + (layerXOffsets.get(node.layer) || 0),
        y: node.y + yOffset,
        width: nodeWidth, // ノード幅を適用
      }
    })

    // エッジパスを滑らかなベジェ曲線で再生成
    const spacedEdges = data.edges.map((edge) => {
      const sourceNode = spacedNodes.find(n => n.id === edge.sourceId)
      const targetNode = spacedNodes.find(n => n.id === edge.targetId)

      if (!sourceNode || !targetNode) return edge

      // Sankey-style Bezier curve path
      const path = generateSankeyPath(
        sourceNode.x + sourceNode.width / 2,  // Right edge of source
        sourceNode.y,                          // Center of source
        targetNode.x - targetNode.width / 2,   // Left edge of target
        targetNode.y                           // Center of target
      )

      return {
        ...edge,
        path
      }
    })

    // バウンディングボックス再計算
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const node of spacedNodes) {
      minX = Math.min(minX, node.x - node.width / 2)
      maxX = Math.max(maxX, node.x + node.width / 2)
      minY = Math.min(minY, node.y - node.height / 2)
      maxY = Math.max(maxY, node.y + node.height / 2)
    }

    return {
      ...data,
      nodes: spacedNodes,
      edges: spacedEdges,
      bounds: {
        minX: Math.floor(minX),
        maxX: Math.ceil(maxX),
        minY: Math.floor(minY),
        maxY: Math.ceil(maxY),
      }
    }
  }, [data, nodeSpacingX, nodeSpacingY, nodeWidth])

  // Handle fit to screen - calculate zoom to fit entire bounds
  const handleFitToScreen = useCallback(() => {
    if (!scaledData) return

    // Calculate center of bounds
    const centerX = (scaledData.bounds.minX + scaledData.bounds.maxX) / 2
    const centerY = (scaledData.bounds.minY + scaledData.bounds.maxY) / 2

    // Calculate bounds size
    const boundsWidth = scaledData.bounds.maxX - scaledData.bounds.minX
    const boundsHeight = scaledData.bounds.maxY - scaledData.bounds.minY

    // Use actual window size (accounting for minimap width)
    const MINIMAP_WIDTH = 120
    const viewportWidth = window.innerWidth - MINIMAP_WIDTH
    const viewportHeight = window.innerHeight

    // Calculate zoom level to fit bounds with some padding
    const padding = 1.1 // 10% padding
    const zoomX = Math.log2(viewportWidth / (boundsWidth * padding))
    const zoomY = Math.log2(viewportHeight / (boundsHeight * padding))
    const fitZoom = Math.min(zoomX, zoomY)

    // Reset view state to center with calculated zoom
    setViewState({
      target: [centerX, centerY],
      zoom: fitZoom,
      minZoom: -13,
      maxZoom: 6,
    })
  }, [scaledData])

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
          <p className="text-slate-400">Loading budget flow data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">Error loading data</p>
          <p className="text-slate-500 text-sm">{error.message}</p>
          <p className="text-slate-600 text-xs mt-4">
            Make sure layout.json exists in public/data/
          </p>
        </div>
      </div>
    )
  }

  if (!scaledData) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <p className="text-slate-500">No data available</p>
      </div>
    )
  }

  const MINIMAP_WIDTH = 120

  // Create initial viewState for minimap before DeckGL reports back
  const initialViewState: OrthographicViewState = {
    target: [(scaledData.bounds.minX + scaledData.bounds.maxX) / 2, (scaledData.bounds.minY + scaledData.bounds.maxY) / 2],
    zoom: -4,
    minZoom: -13,
    maxZoom: 6,
  }

  const effectiveViewState = viewState || initialViewState
  const currentZoom = typeof effectiveViewState.zoom === 'number' ? effectiveViewState.zoom : -4

  return (
    <div className="relative h-full w-full">
      {/* Main canvas */}
      <div className="absolute inset-0" style={{ right: MINIMAP_WIDTH }}>
        <DeckGLCanvas
          layoutData={scaledData}
          onViewStateChange={handleViewStateChange}
          externalTarget={navigateTarget}
          externalZoom={currentZoom}
          externalSelectedNodeId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
        />
      </div>
      {/* Minimap on right */}
      <Minimap
        layoutData={scaledData}
        viewState={effectiveViewState}
        onNavigate={handleMinimapNavigate}
        width={MINIMAP_WIDTH}
      />
      {/* Search Panel */}
      <SearchPanel
        nodes={scaledData.nodes}
        onNodeSelect={handleSearchSelect}
      />
      {/* TopN Settings */}
      <TopNSettings
        topProjects={topProjects}
        topRecipients={topRecipients}
        threshold={threshold}
        onTopProjectsChange={setTopProjects}
        onTopRecipientsChange={setTopRecipients}
        onThresholdChange={setThreshold}
      />
      {/* Map Controls */}
      <MapControls
        zoom={currentZoom}
        minZoom={-13}
        maxZoom={6}
        onZoomChange={handleZoomChange}
        nodeSpacingX={nodeSpacingX}
        nodeSpacingY={nodeSpacingY}
        nodeWidth={nodeWidth}
        onNodeSpacingXChange={setNodeSpacingX}
        onNodeSpacingYChange={setNodeSpacingY}
        onNodeWidthChange={setNodeWidth}
        onFitToScreen={handleFitToScreen}
      />
    </div>
  )
}

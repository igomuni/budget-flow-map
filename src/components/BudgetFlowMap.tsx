import { useState, useCallback, useMemo } from 'react'
import type { OrthographicViewState } from '@deck.gl/core'
import { useLayoutData } from '@/hooks/useLayoutData'
import { useDynamicTopN } from '@/hooks/useDynamicTopN'
import { DeckGLCanvas } from './DeckGLCanvas'
import { Minimap } from './Minimap'
import { MapControls } from './MapControls'
import { TopNSettings } from './TopNSettings'
import type { LayoutData } from '@/types/layout'

export function BudgetFlowMap() {
  const { data: rawData, loading, error } = useLayoutData()
  const [viewState, setViewState] = useState<OrthographicViewState | null>(null)
  const [navigateTarget, setNavigateTarget] = useState<[number, number] | null>(null)
  const [nodeSpacingX, setNodeSpacingX] = useState(0) // px単位
  const [nodeSpacingY, setNodeSpacingY] = useState(0) // px単位
  const [nodeWidth, setNodeWidth] = useState(50) // px単位
  const [topProjects, setTopProjects] = useState(500)
  const [topRecipients, setTopRecipients] = useState(1000)
  const [threshold, setThreshold] = useState(1e12) // 1兆円 = 1,000,000,000,000円

  // 動的TopNフィルタリングを適用
  const data = useDynamicTopN(rawData, { topProjects, topRecipients, threshold })

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
    // 各レイヤーごとにX方向の間隔を追加
    const layerXOffsets = new Map<number, number>()
    for (let layer = 0; layer <= 4; layer++) {
      layerXOffsets.set(layer, layer * nodeSpacingX)
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

    // エッジパスも同様にオフセット
    const spacedEdges = data.edges.map((edge) => {
      const sourceNode = spacedNodes.find(n => n.id === edge.sourceId)
      const targetNode = spacedNodes.find(n => n.id === edge.targetId)

      if (!sourceNode || !targetNode) return edge

      // エッジの開始点と終了点を更新
      return {
        ...edge,
        path: [
          [sourceNode.x + sourceNode.width / 2, sourceNode.y],
          [targetNode.x - targetNode.width / 2, targetNode.y]
        ]
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
          externalZoom={viewState ? currentZoom : undefined}
        />
      </div>
      {/* Minimap on right */}
      <Minimap
        layoutData={scaledData}
        viewState={effectiveViewState}
        onNavigate={handleMinimapNavigate}
        width={MINIMAP_WIDTH}
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

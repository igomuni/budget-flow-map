import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import type { LayoutData, LayoutNode } from '@/types/layout'

// Debug用: 実際に表示されているデータをwindowに公開
declare global {
  interface Window {
    __BUDGET_FLOW_MAP_DATA__: LayoutData | null
    exportDisplayedNodes: () => void
  }
}
import type { OrthographicViewState } from '@deck.gl/core'
import { useLayoutData } from '@/hooks/useLayoutData'
import { useStore } from '@/store'
import { DeckGLCanvas } from './DeckGLCanvas'
import { Minimap } from './Minimap'
import { MapControls } from './MapControls'
import { SidePanel } from './SidePanel'
import { generateSankeyPath } from '@/utils/sankeyPath'
import { getNodeIdFromUrl, updateUrlWithNodeId } from '@/utils/urlState'

export function BudgetFlowMap() {
  const { data: rawData, loading, error } = useLayoutData()
  const [viewState, setViewState] = useState<OrthographicViewState | null>(null)
  const [nodeSpacingX, setNodeSpacingX] = useState(0) // px単位
  const [nodeSpacingY, setNodeSpacingY] = useState(0) // px単位
  const [nodeWidth, setNodeWidth] = useState(50) // px単位

  // Zustand store for selection state
  const selectedNodeId = useStore((state) => state.selectedNodeId)
  const selectedNodeData = useStore((state) => state.selectedNodeData)
  const setSelectedNode = useStore((state) => state.setSelectedNode)

  // Animation ref for smooth transitions
  const animationRef = useRef<number | null>(null)

  // Track if initial URL load is complete
  const initialUrlLoadRef = useRef(false)

  // Ref to track current viewState without causing re-renders
  const viewStateRef = useRef<OrthographicViewState | null>(null)

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // rawDataをそのまま使用（ズームベースの可視性はDeckGLCanvasで処理）
  const data = rawData

  // Animate to target position with easing (GoogleMap風)
  const animateTo = useCallback((targetX: number, targetY: number, targetZoom: number, duration: number = 500) => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const startTime = performance.now()
    // Use ref to get current viewState without dependency
    const currentViewState = viewStateRef.current
    const startX = currentViewState?.target?.[0] ?? 0
    const startY = currentViewState?.target?.[1] ?? 0
    const startZoom = typeof currentViewState?.zoom === 'number' ? currentViewState.zoom : -4

    // Easing function (ease-out cubic)
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutCubic(progress)

      const newX = startX + (targetX - startX) * easedProgress
      const newY = startY + (targetY - startY) * easedProgress
      const newZoom = startZoom + (targetZoom - startZoom) * easedProgress

      const newViewState = {
        target: [newX, newY] as [number, number],
        zoom: newZoom,
        minZoom: -13,
        maxZoom: 6,
      }

      setViewState(newViewState)
      viewStateRef.current = newViewState

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [])

  // Update URL when node selection changes (include node name for readability)
  useEffect(() => {
    if (initialUrlLoadRef.current) {
      updateUrlWithNodeId(selectedNodeId, selectedNodeData?.name)
    }
  }, [selectedNodeId, selectedNodeData])

  // Handle search result selection - navigate to node and select it
  const handleSearchSelect = useCallback((node: LayoutNode) => {
    // Set selected node in store (opens InfoPanel)
    setSelectedNode(node.id, node)

    // Animate to node position (GoogleMap風スムーズアニメーション)
    const currentZoom = typeof viewStateRef.current?.zoom === 'number' ? viewStateRef.current.zoom : -4
    const targetZoom = Math.max(currentZoom, -2) // Zoom in if too far out
    animateTo(node.x, node.y, targetZoom, 600)
  }, [setSelectedNode, animateTo])

  const handleViewStateChange = useCallback((vs: OrthographicViewState) => {
    setViewState(vs)
    viewStateRef.current = vs
  }, [])

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
    // Immediately set view position (no animation for drag responsiveness)
    const currentZoom = typeof viewStateRef.current?.zoom === 'number' ? viewStateRef.current.zoom : -4
    const newViewState = {
      target: [x, y] as [number, number],
      zoom: currentZoom,
      minZoom: -13,
      maxZoom: 6,
    }
    setViewState(newViewState)
    viewStateRef.current = newViewState
  }, [])

  // Handle zoom change from controls
  const handleZoomChange = useCallback((newZoom: number) => {
    const targetX = viewStateRef.current?.target?.[0] ?? 0
    const targetY = viewStateRef.current?.target?.[1] ?? 0
    animateTo(targetX, targetY, newZoom, 200)
  }, [animateTo])

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

  // Debug用: 表示中のデータをwindowに公開
  useEffect(() => {
    window.__BUDGET_FLOW_MAP_DATA__ = scaledData

    // コンソールからノード情報をダウンロードする関数
    window.exportDisplayedNodes = () => {
      if (!scaledData) {
        console.log('No data available')
        return
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        settings: {
          nodeSpacingX,
          nodeSpacingY,
          nodeWidth,
        },
        metadata: scaledData.metadata,
        bounds: scaledData.bounds,
        summary: {
          totalNodes: scaledData.nodes.length,
          totalEdges: scaledData.edges.length,
          byLayer: [0, 1, 2, 3, 4].map(layer => ({
            layer,
            count: scaledData.nodes.filter(n => n.layer === layer).length,
            totalHeight: scaledData.nodes
              .filter(n => n.layer === layer)
              .reduce((sum, n) => sum + n.height, 0),
          })),
        },
        nodes: scaledData.nodes.map(n => ({
          id: n.id,
          name: n.name,
          type: n.type,
          layer: n.layer,
          amount: n.amount,
          amountTrillion: n.amount / 1e12,
          ministryId: n.ministryId,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          isOther: !!n.metadata?.isOther,
          aggregatedCount: n.metadata?.aggregatedCount,
        })),
      }

      // JSONをダウンロード
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `displayed-nodes-${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.json`
      a.click()
      URL.revokeObjectURL(url)

      console.log('Exported', exportData.summary.totalNodes, 'nodes')
      console.log('By layer:', exportData.summary.byLayer)
    }

    console.log('[Debug] Displayed data available at window.__BUDGET_FLOW_MAP_DATA__')
    console.log('[Debug] Run window.exportDisplayedNodes() to download node info')

    return () => {
      window.__BUDGET_FLOW_MAP_DATA__ = null
    }
  }, [scaledData, nodeSpacingX, nodeSpacingY, nodeWidth])

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

    // Animate to fit position
    animateTo(centerX, centerY, fitZoom, 800)
  }, [scaledData, animateTo])

  // Initial load: select node from URL or fit to screen
  useEffect(() => {
    if (!scaledData || initialUrlLoadRef.current) return

    const nodeId = getNodeIdFromUrl()
    if (nodeId) {
      const node = scaledData.nodes.find(n => n.id === nodeId)
      if (node) {
        setSelectedNode(nodeId, node)
        // Navigate to node
        const targetZoom = -2
        animateTo(node.x, node.y, targetZoom, 800)
      }
    } else {
      // No node selected, fit to screen with animation
      handleFitToScreen()
    }

    initialUrlLoadRef.current = true
  }, [scaledData, setSelectedNode, animateTo, handleFitToScreen])

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
    <div className="relative h-full w-full flex">
      {/* Side Panel on left (integrated search + info) */}
      <SidePanel
        nodes={scaledData.nodes}
        edges={scaledData.edges}
        rawNodes={rawData?.nodes || []}
        rawEdges={rawData?.edges || []}
        onNodeSelect={handleSearchSelect}
      />
      {/* Main content area */}
      <div className="flex-1 relative">
        {/* Main canvas */}
        <div className="absolute inset-0" style={{ right: MINIMAP_WIDTH }}>
          <DeckGLCanvas
            layoutData={scaledData}
            onViewStateChange={handleViewStateChange}
            externalViewState={viewState}
          />
        </div>
        {/* Minimap on right */}
        <Minimap
          layoutData={scaledData}
          viewState={effectiveViewState}
          onNavigate={handleMinimapNavigate}
          width={MINIMAP_WIDTH}
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
    </div>
  )
}

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
  const [nodeSpacingX, setNodeSpacingX] = useState(1)
  const [nodeSpacingY, setNodeSpacingY] = useState(1)
  const [topProjects, setTopProjects] = useState(500)
  const [topRecipients, setTopRecipients] = useState(1000)

  // 動的TopNフィルタリングを適用
  const data = useDynamicTopN(rawData, { topProjects, topRecipients })

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

  // Scale layout data based on spacing settings
  const scaledData = useMemo((): LayoutData | null => {
    if (!data) return null

    // Calculate center of original bounds
    const centerX = (data.bounds.minX + data.bounds.maxX) / 2
    const centerY = (data.bounds.minY + data.bounds.maxY) / 2

    // Scale nodes around center
    const scaledNodes = data.nodes.map((node) => ({
      ...node,
      x: centerX + (node.x - centerX) * nodeSpacingX,
      y: centerY + (node.y - centerY) * nodeSpacingY,
    }))

    // Scale edges (Bezier control points)
    const scaledEdges = data.edges.map((edge) => ({
      ...edge,
      path: edge.path.map(([x, y]) => [
        centerX + (x - centerX) * nodeSpacingX,
        centerY + (y - centerY) * nodeSpacingY,
      ] as [number, number]),
    }))

    // Scale bounds
    const scaledBounds = {
      minX: centerX + (data.bounds.minX - centerX) * nodeSpacingX,
      maxX: centerX + (data.bounds.maxX - centerX) * nodeSpacingX,
      minY: centerY + (data.bounds.minY - centerY) * nodeSpacingY,
      maxY: centerY + (data.bounds.maxY - centerY) * nodeSpacingY,
    }

    return {
      ...data,
      nodes: scaledNodes,
      edges: scaledEdges,
      bounds: scaledBounds,
    }
  }, [data, nodeSpacingX, nodeSpacingY])

  // Handle fit to screen - calculate zoom to fit entire bounds
  const handleFitToScreen = useCallback(() => {
    if (!scaledData) return
    const centerX = (scaledData.bounds.minX + scaledData.bounds.maxX) / 2
    const centerY = (scaledData.bounds.minY + scaledData.bounds.maxY) / 2

    // Calculate bounds size
    const boundsWidth = scaledData.bounds.maxX - scaledData.bounds.minX
    const boundsHeight = scaledData.bounds.maxY - scaledData.bounds.minY

    // Assume viewport is roughly 1200x800 (will be adjusted by deck.gl)
    const viewportWidth = 1200
    const viewportHeight = 800

    // Calculate zoom level to fit bounds with some padding
    const padding = 1.1 // 10% padding
    const zoomX = Math.log2(viewportWidth / (boundsWidth * padding))
    const zoomY = Math.log2(viewportHeight / (boundsHeight * padding))
    const fitZoom = Math.min(zoomX, zoomY)

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
        onTopProjectsChange={setTopProjects}
        onTopRecipientsChange={setTopRecipients}
      />
      {/* Map Controls */}
      <MapControls
        zoom={currentZoom}
        minZoom={-13}
        maxZoom={6}
        onZoomChange={handleZoomChange}
        nodeSpacingX={nodeSpacingX}
        nodeSpacingY={nodeSpacingY}
        onNodeSpacingXChange={setNodeSpacingX}
        onNodeSpacingYChange={setNodeSpacingY}
        onFitToScreen={handleFitToScreen}
      />
    </div>
  )
}

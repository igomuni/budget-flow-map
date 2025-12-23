import { useCallback, useMemo, useState, useEffect } from 'react'
import DeckGL from '@deck.gl/react'
import { OrthographicView } from '@deck.gl/core'
import type { PickingInfo, OrthographicViewState } from '@deck.gl/core'
import { useStore } from '@/store'
import { createNodeLayers } from '@/layers/createNodeLayers'
import { createEdgeLayers } from '@/layers/createEdgeLayers'
import type { LayoutData, LayoutNode } from '@/types/layout'

interface DeckGLCanvasProps {
  layoutData: LayoutData
  onViewStateChange?: (viewState: OrthographicViewState) => void
  externalTarget?: [number, number] | null
}

export function DeckGLCanvas({ layoutData, onViewStateChange, externalTarget }: DeckGLCanvasProps) {
  const hoveredNodeId = useStore((state) => state.hoveredNodeId)
  const selectedNodeId = useStore((state) => state.selectedNodeId)
  const setHoveredNode = useStore((state) => state.setHoveredNode)
  const setSelectedNode = useStore((state) => state.setSelectedNode)
  const showTooltip = useStore((state) => state.showTooltip)
  const hideTooltip = useStore((state) => state.hideTooltip)

  // Initialize view state centered on bounds with appropriate zoom
  const initialViewState = useMemo((): OrthographicViewState => {
    const { bounds } = layoutData
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    // Start zoomed out to see the full graph
    return {
      target: [centerX, centerY],
      zoom: -4, // Zoomed out to see full canvas
      minZoom: -6,
      maxZoom: 6,
    }
  }, [layoutData])

  const [viewState, setViewState] = useState<OrthographicViewState>(initialViewState)

  // Handle external navigation (from minimap)
  useEffect(() => {
    if (externalTarget) {
      setViewState((prev) => ({
        ...prev,
        target: externalTarget,
      }))
    }
  }, [externalTarget])

  // Notify parent of view state changes
  useEffect(() => {
    onViewStateChange?.(viewState)
  }, [viewState, onViewStateChange])

  // Create node lookup map for click handling
  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutNode>()
    for (const node of layoutData.nodes) {
      map.set(node.id, node)
    }
    return map
  }, [layoutData.nodes])

  // Create connected edges lookup for highlighting
  const connectedEdges = useMemo(() => {
    const activeId = hoveredNodeId || selectedNodeId
    if (!activeId) return new Set<string>()

    const connected = new Set<string>()
    for (const edge of layoutData.edges) {
      if (edge.sourceId === activeId || edge.targetId === activeId) {
        connected.add(edge.id)
      }
    }
    return connected
  }, [layoutData.edges, hoveredNodeId, selectedNodeId])

  // Create layers
  const layers = useMemo(() => {
    return [
      // Edges behind nodes
      ...createEdgeLayers(
        layoutData.edges,
        connectedEdges,
        !!(hoveredNodeId || selectedNodeId)
      ),
      // Nodes on top
      ...createNodeLayers(
        layoutData.nodes,
        hoveredNodeId,
        selectedNodeId
      ),
    ]
  }, [layoutData, hoveredNodeId, selectedNodeId, connectedEdges])

  // Handle hover
  const handleHover = useCallback(
    (info: PickingInfo) => {
      if (info.object && 'id' in info.object) {
        const node = info.object as LayoutNode
        setHoveredNode(node.id)
        if (info.x !== undefined && info.y !== undefined) {
          showTooltip(info.x, info.y, node.name)
        }
      } else {
        setHoveredNode(null)
        hideTooltip()
      }
    },
    [setHoveredNode, showTooltip, hideTooltip]
  )

  // Handle click
  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (info.object && 'id' in info.object) {
        const node = info.object as LayoutNode
        setSelectedNode(node.id, nodeMap.get(node.id) || null)
      } else {
        // Click on empty space clears selection
        setSelectedNode(null, null)
      }
    },
    [setSelectedNode, nodeMap]
  )

  // Handle view state change
  const handleViewStateChange = useCallback(
    (params: { viewState: OrthographicViewState }) => {
      setViewState(params.viewState)
    },
    []
  )

  // Get cursor based on state
  const getCursor = useCallback(() => {
    if (hoveredNodeId) return 'pointer'
    return 'grab'
  }, [hoveredNodeId])

  return (
    <DeckGL
      views={new OrthographicView({ id: 'main', controller: true })}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      layers={layers}
      onHover={handleHover}
      onClick={handleClick}
      getCursor={getCursor}
      style={{ background: '#1a1a2e' }}
    />
  )
}

import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import DeckGL from '@deck.gl/react'
import { OrthographicView } from '@deck.gl/core'
import type { PickingInfo, OrthographicViewState } from '@deck.gl/core'
import { useStore } from '@/store'
import { createNodeLayers } from '@/layers/createNodeLayers'
import { createEdgeLayers } from '@/layers/createEdgeLayers'
import type { LayoutData, LayoutNode, LayoutEdge } from '@/types/layout'

interface DeckGLCanvasProps {
  layoutData: LayoutData // 元データ（エッジ接続情報用）
  visibleNodes: LayoutNode[] // フィルタリング済みノード
  visibleEdges: LayoutEdge[] // フィルタリング済みエッジ
  onViewStateChange?: (viewState: OrthographicViewState) => void
  externalViewState?: OrthographicViewState | null
}

export function DeckGLCanvas({
  layoutData,
  visibleNodes,
  visibleEdges,
  onViewStateChange,
  externalViewState,
}: DeckGLCanvasProps) {
  const hoveredNodeId = useStore((state) => state.hoveredNodeId)
  const selectedNodeId = useStore((state) => state.selectedNodeId)
  const setHoveredNode = useStore((state) => state.setHoveredNode)
  const setSelectedNode = useStore((state) => state.setSelectedNode)
  const showTooltip = useStore((state) => state.showTooltip)
  const hideTooltip = useStore((state) => state.hideTooltip)

  // Ref for container
  const containerRef = useRef<HTMLDivElement>(null)

  // Initialize view state centered on bounds with appropriate zoom
  const initialViewState = useMemo((): OrthographicViewState => {
    const { bounds } = layoutData
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    // Start zoomed out to see the full graph
    return {
      target: [centerX, centerY],
      zoom: -4, // Zoomed out to see full canvas
      minZoom: -13, // Allow 100x more zoom out
      maxZoom: 8, // zoom=8で閾値≈1500万円、カバー率≈50%
    }
  }, [layoutData])

  const [viewState, setViewState] = useState<OrthographicViewState>(initialViewState)

  // Track if viewState change is from external source (to prevent notification loop)
  const isExternalUpdateRef = useRef(false)

  // Sync with external view state (from parent animation)
  useEffect(() => {
    if (externalViewState) {
      isExternalUpdateRef.current = true
      setViewState(externalViewState)
    }
  }, [externalViewState])

  // Notify parent of view state changes (only for user interactions, not external updates)
  useEffect(() => {
    if (isExternalUpdateRef.current) {
      // Skip notification for external updates
      isExternalUpdateRef.current = false
      return
    }
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

  // Create connected edges and nodes lookup for highlighting
  // Both hover and selection: show all ancestors and descendants (BFS traversal)
  // Combine highlights from both selected and hovered nodes
  const { connectedEdges, connectedNodeIds } = useMemo(() => {
    const activeIds: string[] = []
    if (selectedNodeId) activeIds.push(selectedNodeId)
    if (hoveredNodeId && hoveredNodeId !== selectedNodeId) activeIds.push(hoveredNodeId)

    if (activeIds.length === 0) return { connectedEdges: new Set<string>(), connectedNodeIds: new Set<string>() }

    const edges = new Set<string>()
    const nodeIds = new Set<string>()

    // Add all active nodes themselves
    for (const id of activeIds) {
      nodeIds.add(id)
    }

    // Show all ancestors and descendants (BFS traversal)
    // Build adjacency maps for traversal
    const sourceToTargets = new Map<string, string[]>()
    const targetToSources = new Map<string, string[]>()

    for (const edge of layoutData.edges) {
      // Forward edges (source -> target)
      if (!sourceToTargets.has(edge.sourceId)) {
        sourceToTargets.set(edge.sourceId, [])
      }
      sourceToTargets.get(edge.sourceId)!.push(edge.targetId)

      // Backward edges (target -> source)
      if (!targetToSources.has(edge.targetId)) {
        targetToSources.set(edge.targetId, [])
      }
      targetToSources.get(edge.targetId)!.push(edge.sourceId)
    }

    // BFS to find all descendants (downstream) from all active nodes
    const descendantsQueue = [...activeIds]
    const visitedDescendants = new Set<string>(activeIds)

    while (descendantsQueue.length > 0) {
      const currentId = descendantsQueue.shift()!
      const targets = sourceToTargets.get(currentId) || []

      for (const targetId of targets) {
        if (!visitedDescendants.has(targetId)) {
          visitedDescendants.add(targetId)
          nodeIds.add(targetId)
          descendantsQueue.push(targetId)
        }
      }
    }

    // BFS to find all ancestors (upstream) from all active nodes
    const ancestorsQueue = [...activeIds]
    const visitedAncestors = new Set<string>(activeIds)

    while (ancestorsQueue.length > 0) {
      const currentId = ancestorsQueue.shift()!
      const sources = targetToSources.get(currentId) || []

      for (const sourceId of sources) {
        if (!visitedAncestors.has(sourceId)) {
          visitedAncestors.add(sourceId)
          nodeIds.add(sourceId)
          ancestorsQueue.push(sourceId)
        }
      }
    }

    // Collect all edges connecting the found nodes
    for (const edge of layoutData.edges) {
      if (nodeIds.has(edge.sourceId) && nodeIds.has(edge.targetId)) {
        edges.add(edge.id)
      }
    }

    return { connectedEdges: edges, connectedNodeIds: nodeIds }
  }, [layoutData.edges, hoveredNodeId, selectedNodeId])

  // Create layers with passed visible nodes/edges
  const layers = useMemo(() => {
    return [
      // Edges behind nodes
      ...createEdgeLayers(
        visibleEdges,
        connectedEdges,
        !!(hoveredNodeId || selectedNodeId)  // Both hover and selection highlight edges
      ),
      // Nodes on top
      ...createNodeLayers(
        visibleNodes,
        hoveredNodeId,
        selectedNodeId,
        connectedNodeIds
      ),
    ]
  }, [visibleNodes, visibleEdges, hoveredNodeId, selectedNodeId, connectedEdges, connectedNodeIds])

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
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
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
    </div>
  )
}

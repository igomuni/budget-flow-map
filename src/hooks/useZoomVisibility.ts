import { useMemo } from 'react'
import type { LayoutData, LayoutNode, LayoutEdge, LayerIndex, NodeType } from '@/types/layout'

/**
 * Viewport bounds for culling
 */
export interface ViewportBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Options for zoom-based visibility filtering
 */
export interface ZoomVisibilityOptions {
  zoom: number
  viewportBounds: ViewportBounds | null
}

/**
 * Result of zoom-based visibility filtering
 */
export interface ZoomVisibilityResult {
  visibleNodes: LayoutNode[]
  visibleEdges: LayoutEdge[]
  nodeCount: number
  edgeCount: number
}

/**
 * Base amount thresholds at zoom=0 for each layer
 * These will be divided by 4^zoom to get actual threshold
 *
 * Layer 0-1 (Ministry, Bureau): Always visible (threshold = 0)
 * Layer 2 (Division): 500B yen at zoom 0
 * Layer 3 (Project): 5T yen at zoom 0
 * Layer 4 (Recipient): 10T yen at zoom 0 (to show major recipients like 全国健康保険協会)
 */
const BASE_AMOUNT_THRESHOLDS: Record<LayerIndex, number> = {
  0: 0,           // Ministry: always visible
  1: 0,           // Bureau: always visible
  2: 5e11,        // Division: 500 billion yen at zoom 0
  3: 5e12,        // Project: 5 trillion yen at zoom 0
  4: 1e13,        // Recipient: 10 trillion yen at zoom 0
}

/**
 * Calculate the minimum visible amount for a layer at given zoom level
 *
 * Formula: threshold = baseThreshold / 4^zoom
 *
 * At zoom=0 (1x): uses base threshold
 * At zoom=2 (4x): threshold is 1/16 of base
 * At zoom=4 (16x): threshold is 1/256 of base
 * At zoom=6 (64x): threshold is 1/4096 of base
 */
export function getMinVisibleAmount(layer: LayerIndex, zoom: number): number {
  const baseThreshold = BASE_AMOUNT_THRESHOLDS[layer]
  if (baseThreshold === 0) return 0

  // Each zoom level divides threshold by 4
  // Use max(0, zoom) to handle negative zoom values
  const effectiveZoom = Math.max(0, zoom)
  const reductionFactor = Math.pow(4, effectiveZoom)

  return baseThreshold / reductionFactor
}

/**
 * Check if a layer has any visible nodes at the given zoom level
 * This is approximate based on typical amount distributions
 */
export function isLayerGenerallyVisible(layer: LayerIndex, zoom: number): boolean {
  const threshold = getMinVisibleAmount(layer, zoom)

  // Rough estimates of typical minimum amounts per layer
  const typicalMinAmounts: Record<LayerIndex, number> = {
    0: 1e9,       // 1 billion yen
    1: 1e8,       // 100 million yen
    2: 1e7,       // 10 million yen
    3: 1e6,       // 1 million yen
    4: 1e5,       // 100,000 yen
  }

  return threshold <= typicalMinAmounts[layer] * 100 // Buffer factor
}

/**
 * Node type by layer for creating aggregated nodes
 */
const NODE_TYPE_BY_LAYER: Record<LayerIndex, NodeType> = {
  0: 'ministry',
  1: 'bureau',
  2: 'division',
  3: 'project',
  4: 'recipient',
}

/**
 * Create a dynamic "Other" aggregated node from hidden nodes
 * Position: Placed right next to the parent node (same Y as parent)
 * Height: Based on total amount
 */
function createAggregatedNode(
  parentId: string,
  parentNode: LayoutNode | undefined,
  hiddenNodes: LayoutNode[],
  layer: LayerIndex
): LayoutNode {
  // Calculate total amount
  const totalAmount = hiddenNodes.reduce((sum, n) => sum + n.amount, 0)

  // Height based on amount (same scale as regular nodes: 1兆円 = 10px)
  // Minimum height of 3px for visibility
  const height = Math.max(3, totalAmount / 1e11)

  // Y position: align with parent node's center
  // This keeps the "Other" node visually connected to its parent
  const centerY = parentNode?.y ?? hiddenNodes[0]?.y ?? 0

  // X position: same as hidden nodes' layer X position
  const x = hiddenNodes[0]?.x ?? (parentNode?.x ?? 100) + 300

  // Width: same as typical node width for this layer
  const width = hiddenNodes[0]?.width ?? 80

  // Get ministry ID from parent or hidden nodes
  const ministryId = parentNode?.ministryId ?? hiddenNodes[0]?.ministryId

  return {
    id: `other-${parentId}-${layer}`,
    type: NODE_TYPE_BY_LAYER[layer],
    layer,
    name: `その他 (${hiddenNodes.length}件)`,
    amount: totalAmount,
    ministryId,
    x,
    y: centerY,
    width,
    height,
    metadata: {
      isOther: true,
      aggregatedCount: hiddenNodes.length,
      aggregatedIds: hiddenNodes.map(n => n.id),
    },
  }
}

/**
 * Create dynamic edges for aggregated "Other" nodes
 */
function createAggregatedEdge(
  sourceId: string,
  targetId: string,
  value: number,
  sourceNode: LayoutNode,
  targetNode: LayoutNode
): LayoutEdge {
  // Simple straight path for aggregated edges
  const path: [number, number][] = [
    [sourceNode.x + sourceNode.width / 2, sourceNode.y],
    [targetNode.x - targetNode.width / 2, targetNode.y],
  ]

  return {
    id: `edge-${sourceId}-${targetId}`,
    sourceId,
    targetId,
    value,
    width: Math.max(1, Math.min(20, value / 1e12)), // Scale by 1T yen
    path,
  }
}

/**
 * Check if a node intersects with viewport bounds (with padding)
 */
function isNodeInViewport(node: LayoutNode, bounds: ViewportBounds): boolean {
  const halfWidth = node.width / 2
  const halfHeight = node.height / 2

  const nodeMinX = node.x - halfWidth
  const nodeMaxX = node.x + halfWidth
  const nodeMinY = node.y - halfHeight
  const nodeMaxY = node.y + halfHeight

  return !(
    nodeMaxX < bounds.minX ||
    nodeMinX > bounds.maxX ||
    nodeMaxY < bounds.minY ||
    nodeMinY > bounds.maxY
  )
}

/**
 * Check if an edge intersects with viewport bounds
 * Uses the pre-computed path points for accurate intersection check
 */
function isEdgeInViewport(edge: LayoutEdge, bounds: ViewportBounds): boolean {
  // Check if any path point is within bounds
  for (const [x, y] of edge.path) {
    if (x >= bounds.minX && x <= bounds.maxX &&
        y >= bounds.minY && y <= bounds.maxY) {
      return true
    }
  }

  // Also check if edge passes through bounds even if points are outside
  const firstPoint = edge.path[0]
  const lastPoint = edge.path[edge.path.length - 1]

  // Simple bounding box check for the entire edge
  const edgeMinX = Math.min(firstPoint[0], lastPoint[0])
  const edgeMaxX = Math.max(firstPoint[0], lastPoint[0])
  const edgeMinY = Math.min(firstPoint[1], lastPoint[1])
  const edgeMaxY = Math.max(firstPoint[1], lastPoint[1])

  return !(
    edgeMaxX < bounds.minX ||
    edgeMinX > bounds.maxX ||
    edgeMaxY < bounds.minY ||
    edgeMinY > bounds.maxY
  )
}

/**
 * Calculate viewport bounds from deck.gl OrthographicView state
 */
export function calculateViewportBounds(
  target: [number, number],
  zoom: number,
  viewportWidth: number,
  viewportHeight: number,
  paddingRatio: number = 0.5
): ViewportBounds {
  // deck.gl zoom is log2 scale
  const scale = Math.pow(2, zoom)

  // Calculate world-space size of viewport
  const worldWidth = viewportWidth / scale
  const worldHeight = viewportHeight / scale

  // Add padding for smooth transitions
  const paddedWidth = worldWidth * (1 + paddingRatio)
  const paddedHeight = worldHeight * (1 + paddingRatio)

  const halfWidth = paddedWidth / 2
  const halfHeight = paddedHeight / 2

  return {
    minX: target[0] - halfWidth,
    maxX: target[0] + halfWidth,
    minY: target[1] - halfHeight,
    maxY: target[1] + halfHeight,
  }
}

/**
 * Hook for zoom-based visibility filtering with dynamic aggregation
 *
 * Key features:
 * - Nodes are visible if their amount exceeds the zoom-dependent threshold
 * - Hidden nodes are dynamically aggregated into "Other" nodes by parent
 * - "Other" nodes fill the gaps where hidden nodes would be
 * - Viewport culling removes nodes outside the visible area
 */
export function useZoomVisibility(
  data: LayoutData | null,
  options: ZoomVisibilityOptions
): ZoomVisibilityResult | null {
  const { zoom, viewportBounds } = options

  return useMemo(() => {
    if (!data) return null

    // Calculate visibility thresholds for each layer
    const thresholds = new Map<LayerIndex, number>()
    for (let layer = 0; layer <= 4; layer++) {
      thresholds.set(layer as LayerIndex, getMinVisibleAmount(layer as LayerIndex, zoom))
    }

    // Build node lookup map
    const nodeMap = new Map<string, LayoutNode>()
    for (const node of data.nodes) {
      nodeMap.set(node.id, node)
    }

    // Build parent-child relationship map from edges
    // parentToChildren: parentId -> childId[]
    const parentToChildren = new Map<string, string[]>()
    const childToParent = new Map<string, string>()
    for (const edge of data.edges) {
      const children = parentToChildren.get(edge.sourceId) || []
      children.push(edge.targetId)
      parentToChildren.set(edge.sourceId, children)
      childToParent.set(edge.targetId, edge.sourceId)
    }

    // Step 1: Classify nodes as visible or hidden based on amount threshold
    const visibleNodeIds = new Set<string>()
    const hiddenNodesByParent = new Map<string, LayoutNode[]>()

    // Debug: count by layer
    const visibleByLayer = new Map<number, number>()
    const hiddenByLayerCount = new Map<number, number>()

    for (const node of data.nodes) {
      const threshold = thresholds.get(node.layer)!

      if (node.amount >= threshold) {
        // Node is visible
        visibleNodeIds.add(node.id)
        visibleByLayer.set(node.layer, (visibleByLayer.get(node.layer) || 0) + 1)
      } else {
        // Node is hidden - group by parent for aggregation
        const parentId = childToParent.get(node.id) || 'root'
        const hiddenNodes = hiddenNodesByParent.get(parentId) || []
        hiddenNodes.push(node)
        hiddenNodesByParent.set(parentId, hiddenNodes)
        hiddenByLayerCount.set(node.layer, (hiddenByLayerCount.get(node.layer) || 0) + 1)
      }
    }

    console.log(`[ZoomVisibility] zoom=${zoom.toFixed(2)}, thresholds:`, Object.fromEntries(thresholds))
    console.log(`[ZoomVisibility] visible by layer:`, Object.fromEntries(visibleByLayer))
    console.log(`[ZoomVisibility] hidden by layer:`, Object.fromEntries(hiddenByLayerCount))
    console.log(`[ZoomVisibility] hidden groups (by parent):`, hiddenNodesByParent.size)

    // Step 2: Find visible ancestor for each hidden node
    // For nodes with hidden parents, trace up to find the first visible ancestor
    const findVisibleAncestor = (nodeId: string): string | null => {
      let currentId = childToParent.get(nodeId)
      while (currentId) {
        if (visibleNodeIds.has(currentId)) {
          return currentId
        }
        currentId = childToParent.get(currentId)
      }
      return null // No visible ancestor found
    }

    // Regroup hidden nodes by their visible ancestor
    const hiddenNodesByVisibleAncestor = new Map<string, LayoutNode[]>()

    for (const [, hiddenNodes] of hiddenNodesByParent) {
      for (const node of hiddenNodes) {
        const visibleAncestorId = findVisibleAncestor(node.id)
        if (visibleAncestorId) {
          const nodes = hiddenNodesByVisibleAncestor.get(visibleAncestorId) || []
          nodes.push(node)
          hiddenNodesByVisibleAncestor.set(visibleAncestorId, nodes)
        }
        // Nodes without any visible ancestor are orphaned (shouldn't happen normally)
      }
    }

    // Step 3: Create dynamic "Other" aggregated nodes for hidden nodes
    const aggregatedNodes: LayoutNode[] = []
    const aggregatedEdges: LayoutEdge[] = []

    for (const [ancestorId, hiddenNodes] of hiddenNodesByVisibleAncestor) {
      if (hiddenNodes.length === 0) continue

      const ancestorNode = nodeMap.get(ancestorId)!

      // Group hidden nodes by layer
      const hiddenByLayer = new Map<LayerIndex, LayoutNode[]>()
      for (const node of hiddenNodes) {
        const layerNodes = hiddenByLayer.get(node.layer) || []
        layerNodes.push(node)
        hiddenByLayer.set(node.layer, layerNodes)
      }

      // Create an "Other" node for each layer
      for (const [layer, layerHiddenNodes] of hiddenByLayer) {
        const aggregatedNode = createAggregatedNode(
          ancestorId,
          ancestorNode,
          layerHiddenNodes,
          layer
        )
        aggregatedNodes.push(aggregatedNode)
        visibleNodeIds.add(aggregatedNode.id)

        // Create edge from ancestor to aggregated node
        const totalValue = layerHiddenNodes.reduce((sum, n) => sum + n.amount, 0)
        const edge = createAggregatedEdge(
          ancestorId,
          aggregatedNode.id,
          totalValue,
          ancestorNode,
          aggregatedNode
        )
        aggregatedEdges.push(edge)
      }
    }

    console.log(`[ZoomVisibility] created ${aggregatedNodes.length} aggregated nodes, ${aggregatedEdges.length} edges`)

    // Step 4: Collect all visible nodes (original + aggregated)
    const allVisibleNodes: LayoutNode[] = []
    for (const node of data.nodes) {
      if (visibleNodeIds.has(node.id)) {
        allVisibleNodes.push(node)
      }
    }
    allVisibleNodes.push(...aggregatedNodes)

    // Step 5: Filter edges - both endpoints must be visible
    const visibleEdges: LayoutEdge[] = []
    for (const edge of data.edges) {
      if (visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)) {
        visibleEdges.push(edge)
      }
    }
    visibleEdges.push(...aggregatedEdges)

    // Step 6: Apply viewport culling if bounds provided
    let finalNodes = allVisibleNodes
    let finalEdges = visibleEdges
    if (viewportBounds) {
      finalNodes = allVisibleNodes.filter(node =>
        isNodeInViewport(node, viewportBounds)
      )

      // Build set of visible node IDs after viewport culling
      const finalNodeIds = new Set(finalNodes.map(n => n.id))
      finalEdges = visibleEdges.filter(edge =>
        isEdgeInViewport(edge, viewportBounds) ||
        finalNodeIds.has(edge.sourceId) ||
        finalNodeIds.has(edge.targetId)
      )
    }

    return {
      visibleNodes: finalNodes,
      visibleEdges: finalEdges,
      nodeCount: finalNodes.length,
      edgeCount: finalEdges.length,
    }
  }, [data, zoom, viewportBounds])
}

/**
 * Get layer visibility status for UI indicator
 */
export function getLayerVisibilityStatus(zoom: number): Record<LayerIndex, boolean> {
  return {
    0: true,  // Ministry: always visible
    1: true,  // Bureau: always visible
    2: isLayerGenerallyVisible(2, zoom),
    3: isLayerGenerallyVisible(3, zoom),
    4: isLayerGenerallyVisible(4, zoom),
  }
}

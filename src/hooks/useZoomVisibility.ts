import { useMemo } from 'react'
import type { LayoutData, LayoutNode, LayoutEdge, LayerIndex } from '@/types/layout'

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
 * Layer 4 (Recipient): 10T yen at zoom 0
 */
const BASE_AMOUNT_THRESHOLDS: Record<LayerIndex, number> = {
  0: 0,           // Ministry: always visible
  1: 0,           // Bureau: always visible
  2: 5e11,        // Division: 500 billion yen at zoom 0
  3: 5e12,        // Project: 5 trillion yen at zoom 0
  4: 1e13,        // Recipient: 10 trillion yen at zoom 0
}

/**
 * X position for each layer (same as compute-layout.ts)
 */
const LAYER_X_POSITIONS: Record<LayerIndex, number> = {
  0: 100,
  1: 500,
  2: 900,
  3: 1300,
  4: 1700,
}

const NODE_WIDTH = 50

/**
 * Calculate the minimum visible amount for a layer at given zoom level
 *
 * Formula: threshold = baseThreshold / 4^zoom
 */
export function getMinVisibleAmount(layer: LayerIndex, zoom: number): number {
  const baseThreshold = BASE_AMOUNT_THRESHOLDS[layer]
  if (baseThreshold === 0) return 0

  const effectiveZoom = Math.max(0, zoom)
  const reductionFactor = Math.pow(4, effectiveZoom)

  return baseThreshold / reductionFactor
}

/**
 * Check if a layer has any visible nodes at the given zoom level
 */
export function isLayerGenerallyVisible(layer: LayerIndex, zoom: number): boolean {
  const threshold = getMinVisibleAmount(layer, zoom)

  const typicalMinAmounts: Record<LayerIndex, number> = {
    0: 1e9,
    1: 1e8,
    2: 1e7,
    3: 1e6,
    4: 1e5,
  }

  return threshold <= typicalMinAmounts[layer] * 100
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
 */
function isEdgeInViewport(edge: LayoutEdge, bounds: ViewportBounds): boolean {
  for (const [x, y] of edge.path) {
    if (x >= bounds.minX && x <= bounds.maxX &&
        y >= bounds.minY && y <= bounds.maxY) {
      return true
    }
  }

  const firstPoint = edge.path[0]
  const lastPoint = edge.path[edge.path.length - 1]

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
  const scale = Math.pow(2, zoom)

  const worldWidth = viewportWidth / scale
  const worldHeight = viewportHeight / scale

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
 * Hook for zoom-based visibility filtering with layer-level aggregation
 *
 * Key approach:
 * 1. For each layer, sort nodes by amount (descending)
 * 2. Nodes above threshold -> visible
 * 3. Nodes below threshold -> aggregated into ONE "Other" node per layer
 * 4. Y coordinates are RECALCULATED for visible nodes (packed tightly)
 * 5. No edges to "Other" nodes
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

    // Group nodes by layer
    const nodesByLayer = new Map<LayerIndex, LayoutNode[]>()
    for (let layer = 0; layer <= 4; layer++) {
      nodesByLayer.set(layer as LayerIndex, [])
    }
    for (const node of data.nodes) {
      nodesByLayer.get(node.layer)!.push(node)
    }

    // Process each layer: separate visible and hidden nodes, recalculate Y positions
    const visibleNodeIds = new Set<string>()
    const repositionedNodes: LayoutNode[] = []
    const newNodePositions = new Map<string, { x: number; y: number }>()

    // Debug counts
    const visibleByLayer = new Map<number, number>()
    const hiddenByLayer = new Map<number, number>()

    for (let layer = 0; layer <= 4; layer++) {
      const layerIndex = layer as LayerIndex
      const nodes = nodesByLayer.get(layerIndex)!
      const threshold = thresholds.get(layerIndex)!

      // Sort by amount descending
      const sortedNodes = [...nodes].sort((a, b) => b.amount - a.amount)

      const visibleNodes: LayoutNode[] = []
      const hiddenNodes: LayoutNode[] = []

      for (const node of sortedNodes) {
        if (node.amount >= threshold) {
          visibleNodes.push(node)
          visibleNodeIds.add(node.id)
        } else {
          hiddenNodes.push(node)
        }
      }

      visibleByLayer.set(layer, visibleNodes.length)
      hiddenByLayer.set(layer, hiddenNodes.length)

      // Recalculate Y positions for visible nodes (pack them tightly)
      const layerX = LAYER_X_POSITIONS[layerIndex] + NODE_WIDTH / 2
      let currentY = 0

      for (const node of visibleNodes) {
        // Create repositioned node with new Y coordinate
        const repositionedNode: LayoutNode = {
          ...node,
          x: layerX,
          y: currentY + node.height / 2,
        }
        repositionedNodes.push(repositionedNode)
        newNodePositions.set(node.id, { x: repositionedNode.x, y: repositionedNode.y })

        currentY += node.height // No gap between nodes
      }

      // Create "Other" node if there are hidden nodes
      if (hiddenNodes.length > 0) {
        const totalAmount = hiddenNodes.reduce((sum, n) => sum + n.amount, 0)
        const height = Math.max(3, totalAmount / 1e11) // 1兆円 = 10px

        const otherNode: LayoutNode = {
          id: `other-layer-${layer}`,
          type: layer === 4 ? 'recipient' : layer === 3 ? 'project' : layer === 2 ? 'division' : layer === 1 ? 'bureau' : 'ministry',
          layer: layerIndex,
          name: `その他 (${hiddenNodes.length}件)`,
          amount: totalAmount,
          ministryId: undefined,
          x: layerX,
          y: currentY + height / 2,
          width: NODE_WIDTH,
          height,
          metadata: {
            isOther: true,
            aggregatedCount: hiddenNodes.length,
            aggregatedIds: hiddenNodes.map(n => n.id),
          },
        }
        repositionedNodes.push(otherNode)
        visibleNodeIds.add(otherNode.id)
        newNodePositions.set(otherNode.id, { x: otherNode.x, y: otherNode.y })
      }
    }

    console.log(`[ZoomVisibility] zoom=${zoom.toFixed(2)}, thresholds:`, Object.fromEntries(thresholds))
    console.log(`[ZoomVisibility] visible by layer:`, Object.fromEntries(visibleByLayer))
    console.log(`[ZoomVisibility] hidden by layer:`, Object.fromEntries(hiddenByLayer))

    // Filter and reposition edges
    // Both endpoints must be visible, and we need to update path coordinates
    const visibleEdges: LayoutEdge[] = []
    for (const edge of data.edges) {
      if (visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)) {
        // Skip edges involving "Other" nodes
        if (edge.targetId.startsWith('other-') || edge.sourceId.startsWith('other-')) {
          continue
        }

        const sourcePos = newNodePositions.get(edge.sourceId)
        const targetPos = newNodePositions.get(edge.targetId)

        if (sourcePos && targetPos) {
          // Recalculate edge path with new node positions
          // Simple straight line for now (Bezier would need more work)
          const newPath: [number, number][] = [
            [sourcePos.x + NODE_WIDTH / 2, sourcePos.y],
            [targetPos.x - NODE_WIDTH / 2, targetPos.y],
          ]

          visibleEdges.push({
            ...edge,
            path: newPath,
          })
        }
      }
    }

    // Apply viewport culling if bounds provided
    let finalNodes = repositionedNodes
    let finalEdges = visibleEdges
    if (viewportBounds) {
      finalNodes = repositionedNodes.filter(node =>
        isNodeInViewport(node, viewportBounds)
      )

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
    0: true,
    1: true,
    2: isLayerGenerallyVisible(2, zoom),
    3: isLayerGenerallyVisible(3, zoom),
    4: isLayerGenerallyVisible(4, zoom),
  }
}

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
 * Layer 4 (Recipient): 20T yen at zoom 0
 */
const BASE_AMOUNT_THRESHOLDS: Record<LayerIndex, number> = {
  0: 0,           // Ministry: always visible
  1: 0,           // Bureau: always visible
  2: 5e11,        // Division: 500 billion yen at zoom 0
  3: 5e12,        // Project: 5 trillion yen at zoom 0
  4: 2e13,        // Recipient: 20 trillion yen at zoom 0
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
 * Hook for zoom-based visibility filtering with viewport culling
 *
 * Replaces useDynamicTopN with a zoom-responsive approach:
 * - Nodes are visible if their amount exceeds the zoom-dependent threshold
 * - Viewport culling removes nodes outside the visible area
 * - No "Other" aggregation - all nodes are individually visible at sufficient zoom
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

    // Step 1: Filter nodes by amount threshold
    // "Other" (aggregated) nodes are always visible regardless of amount
    const amountVisibleNodeIds = new Set<string>()
    const amountVisibleNodes: LayoutNode[] = []

    for (const node of data.nodes) {
      const threshold = thresholds.get(node.layer)!
      // Always show "Other" nodes, or nodes that meet the threshold
      if (node.metadata?.isOther || node.amount >= threshold) {
        amountVisibleNodeIds.add(node.id)
        amountVisibleNodes.push(node)
      }
    }

    // Step 2: Apply viewport culling if bounds provided
    let visibleNodes = amountVisibleNodes
    if (viewportBounds) {
      visibleNodes = amountVisibleNodes.filter(node =>
        isNodeInViewport(node, viewportBounds)
      )
    }

    // Step 3: Filter edges - both endpoints must be amount-visible
    // and at least one must be in viewport (if culling is enabled)
    const visibleEdges = data.edges.filter(edge => {
      // Both source and target must pass amount threshold
      if (!amountVisibleNodeIds.has(edge.sourceId) ||
          !amountVisibleNodeIds.has(edge.targetId)) {
        return false
      }

      // Apply viewport culling if enabled
      if (viewportBounds) {
        return isEdgeInViewport(edge, viewportBounds)
      }
      return true
    })

    return {
      visibleNodes,
      visibleEdges,
      nodeCount: visibleNodes.length,
      edgeCount: visibleEdges.length,
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

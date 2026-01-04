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
 * Fixed threshold for visibility filtering (1兆円)
 *
 * This value determines which nodes are shown at full size vs minimum size.
 * Set to 1兆円 based on analysis of Japanese government budget ranges (10 digits).
 * See: docs/20251230_0030_height-scale-analysis.md
 */
const VISIBILITY_THRESHOLD = 1e12 // 1兆円

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
 *
 * Layer 0-1 (Ministry, Bureau): Always visible (threshold = 0)
 * Layer 2-4: Use fixed threshold (1兆円)
 */
const BASE_THRESHOLDS: Record<LayerIndex, number> = {
  0: 0,                    // Ministry: always visible
  1: 0,                    // Bureau: always visible
  2: VISIBILITY_THRESHOLD, // Division: 1兆円
  3: VISIBILITY_THRESHOLD, // Project: 1兆円
  4: VISIBILITY_THRESHOLD, // Recipient: 1兆円
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
const MIN_NODE_HEIGHT = 1 // 閾値以下のノードの最小高さ
const MIN_OTHER_NODE_HEIGHT = 3 // 「その他」ノードの最小高さ（視認性確保）
const HEIGHT_SCALE = 1e-11 // 1兆円 = 10px

/**
 * Calculate node height from amount
 * Same logic as compute-layout.ts
 *
 * @param amount - 金額（円単位）
 * @param isOther - 「その他」ノードかどうか
 */
function amountToHeight(amount: number, isOther: boolean = false): number {
  if (amount <= 0) return isOther ? MIN_OTHER_NODE_HEIGHT : MIN_NODE_HEIGHT

  // 「その他」ノードは閾値を無視して金額比例、最小高さも大きめ
  if (isOther) {
    return Math.max(MIN_OTHER_NODE_HEIGHT, amount * HEIGHT_SCALE)
  }

  // 通常ノード: 閾値以下は最小高さ
  if (amount <= VISIBILITY_THRESHOLD) {
    return MIN_NODE_HEIGHT
  }

  return Math.max(MIN_NODE_HEIGHT, amount * HEIGHT_SCALE)
}

/**
 * Calculate the minimum visible amount for a layer at given zoom level
 *
 * Formula: threshold = baseThreshold / 4^zoom
 */
export function getMinVisibleAmount(
  layer: LayerIndex,
  zoom: number
): number {
  const baseThreshold = BASE_THRESHOLDS[layer]
  if (baseThreshold === 0) return 0

  const effectiveZoom = Math.max(0, zoom)
  const reductionFactor = Math.pow(4, effectiveZoom)

  return baseThreshold / reductionFactor
}

/**
 * Check if a layer has any visible nodes at the given zoom level
 */
export function isLayerGenerallyVisible(
  layer: LayerIndex,
  zoom: number
): boolean {
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

    // Get unique ministry IDs from Layer 0 nodes, sorted by amount
    const ministryNodes = nodesByLayer.get(0 as LayerIndex)!
    const sortedMinistries = [...ministryNodes].sort((a, b) => b.amount - a.amount)
    const ministryOrder = sortedMinistries.map(n => n.ministryId || n.id)

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

      let sortedNodes: LayoutNode[]

      if (layer <= 2) {
        // Layer 0-2 (府省, 局, 課): 府省庁ごとにグループ化し、その中で金額順ソート
        // Group nodes by ministry
        const nodesByMinistry = new Map<string, LayoutNode[]>()
        for (const ministryId of ministryOrder) {
          nodesByMinistry.set(ministryId, [])
        }
        nodesByMinistry.set('unknown', []) // For nodes without ministryId

        for (const node of nodes) {
          const ministryId = node.ministryId || (layer === 0 ? node.id : 'unknown')
          if (nodesByMinistry.has(ministryId)) {
            nodesByMinistry.get(ministryId)!.push(node)
          } else {
            nodesByMinistry.get('unknown')!.push(node)
          }
        }

        // Sort each ministry group by amount and concatenate
        sortedNodes = []
        for (const ministryId of ministryOrder) {
          const ministryNodes = nodesByMinistry.get(ministryId) || []
          ministryNodes.sort((a, b) => b.amount - a.amount)
          sortedNodes.push(...ministryNodes)
        }
        // Add unknown ministry nodes at the end
        const unknownNodes = nodesByMinistry.get('unknown') || []
        unknownNodes.sort((a, b) => b.amount - a.amount)
        sortedNodes.push(...unknownNodes)
      } else {
        // Layer 3-4 (事業, 支出先): 全体で金額順ソート
        sortedNodes = [...nodes].sort((a, b) => b.amount - a.amount)
      }

      const layerX = LAYER_X_POSITIONS[layerIndex] + NODE_WIDTH / 2
      let currentY = 0

      if (layer <= 2) {
        // Layer 0-2 (府省, 局, 課): 集約せず全ノード表示、閾値以下は最小高さ
        let aboveThresholdCount = 0
        let belowThresholdCount = 0

        for (const node of sortedNodes) {
          const isAboveThreshold = node.amount >= threshold
          if (isAboveThreshold) {
            aboveThresholdCount++
          } else {
            belowThresholdCount++
          }

          // 金額から高さを再計算（閾値以下は最小高さ）
          const effectiveHeight = amountToHeight(node.amount)

          const repositionedNode: LayoutNode = {
            ...node,
            x: layerX,
            y: currentY + effectiveHeight / 2,
            height: effectiveHeight,
          }
          repositionedNodes.push(repositionedNode)
          visibleNodeIds.add(node.id)
          newNodePositions.set(node.id, { x: repositionedNode.x, y: repositionedNode.y })

          currentY += effectiveHeight
        }

        visibleByLayer.set(layer, aboveThresholdCount)
        hiddenByLayer.set(layer, belowThresholdCount)
      } else {
        // Layer 3-4 (事業, 支出先): 閾値以上のみ表示、閾値以下は「その他」に集約
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

        for (const node of visibleNodes) {
          // 金額から高さを再計算
          const effectiveHeight = amountToHeight(node.amount)

          const repositionedNode: LayoutNode = {
            ...node,
            x: layerX,
            y: currentY + effectiveHeight / 2,
            height: effectiveHeight,
          }
          repositionedNodes.push(repositionedNode)
          newNodePositions.set(node.id, { x: repositionedNode.x, y: repositionedNode.y })

          currentY += effectiveHeight
        }

        // Create "Other" node if there are hidden nodes
        if (hiddenNodes.length > 0) {
          const totalAmount = hiddenNodes.reduce((sum, n) => sum + n.amount, 0)
          const height = amountToHeight(totalAmount, true) // isOther = true

          const otherNode: LayoutNode = {
            id: `other-layer-${layer}`,
            type: layer === 4 ? 'recipient' : 'project',
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
export function getLayerVisibilityStatus(
  zoom: number
): Record<LayerIndex, boolean> {
  return {
    0: true,
    1: true,
    2: isLayerGenerallyVisible(2, zoom),
    3: isLayerGenerallyVisible(3, zoom),
    4: isLayerGenerallyVisible(4, zoom),
  }
}

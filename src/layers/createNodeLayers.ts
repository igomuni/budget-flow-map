import { PolygonLayer, TextLayer } from '@deck.gl/layers'
import type { LayoutNode, LayerIndex } from '@/types/layout'
import { getNodeColor } from '@/utils/colorScheme'
import { getVisibleLabels, getLabelSize, getMaxLabelsPerLayer } from '@/utils/zoomThresholds'

/**
 * Create PolygonLayers for nodes as vertical bars (Sankey-style)
 */
export function createNodeLayers(
  nodes: LayoutNode[],
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  connectedNodeIds: Set<string>,
  zoom: number = 0
): (PolygonLayer<LayoutNode> | TextLayer<LayoutNode>)[] {
  const hasActiveSelection = !!(hoveredNodeId || selectedNodeId)
  // Group nodes by layer
  const nodesByLayer = new Map<number, LayoutNode[]>()

  for (const node of nodes) {
    const layerNodes = nodesByLayer.get(node.layer) || []
    layerNodes.push(node)
    nodesByLayer.set(node.layer, layerNodes)
  }

  // Create a layer for each group
  const layers: (PolygonLayer<LayoutNode> | TextLayer<LayoutNode>)[] = []

  for (const [layerIndex, layerNodes] of nodesByLayer) {
    layers.push(
      new PolygonLayer<LayoutNode>({
        id: `nodes-layer-${layerIndex}`,
        data: layerNodes,
        pickable: true,

        // Create rectangular polygon for each node
        // Rectangle centered at (x, y) with width and height
        getPolygon: (d) => {
          const halfWidth = d.width / 2
          const halfHeight = d.height / 2
          return [
            [d.x - halfWidth, d.y - halfHeight],
            [d.x + halfWidth, d.y - halfHeight],
            [d.x + halfWidth, d.y + halfHeight],
            [d.x - halfWidth, d.y + halfHeight],
          ]
        },

        // Fill color with hover highlighting (selection doesn't change fill)
        getFillColor: (d) => {
          const baseColor = getNodeColor(d)

          if (d.id === hoveredNodeId) {
            return [255, 255, 255, 255] // White for hovered
          }

          // Reduce opacity for non-connected nodes when there's an active selection
          if (hasActiveSelection && !connectedNodeIds.has(d.id)) {
            // Make background nodes more transparent
            return [baseColor[0], baseColor[1], baseColor[2], 51] // 20% opacity
          }

          return baseColor
        },

        // Stroke - only show for selected/hovered nodes
        stroked: true,
        getLineColor: (d) => {
          if (d.id === selectedNodeId) {
            return [255, 200, 0, 255] as [number, number, number, number] // Bright gold stroke for selected
          }
          if (d.id === hoveredNodeId) {
            return [255, 255, 255, 255] as [number, number, number, number] // White stroke for hovered
          }
          return [0, 0, 0, 0] as [number, number, number, number] // No stroke otherwise
        },
        getLineWidth: (d) => {
          if (d.id === selectedNodeId || d.id === hoveredNodeId) {
            return 3 // Thicker stroke for selected/hovered
          }
          return 0
        },
        lineWidthMinPixels: 0,
        lineWidthMaxPixels: 3,

        // Performance: only update colors when selection changes
        updateTriggers: {
          getFillColor: [hoveredNodeId, selectedNodeId, connectedNodeIds],
          getLineColor: [selectedNodeId],
          getLineWidth: [selectedNodeId],
        },
      })
    )
  }

  // Add text labels based on zoom level
  const visibleLabelNodes = getVisibleLabels(nodes, zoom)

  // Group visible labels by layer and limit per layer
  const labelsByLayer = new Map<number, LayoutNode[]>()
  for (const node of visibleLabelNodes) {
    const layerNodes = labelsByLayer.get(node.layer) || []
    layerNodes.push(node)
    labelsByLayer.set(node.layer, layerNodes)
  }

  // Create text layer for each layer group
  for (const [layerIndex, layerNodes] of labelsByLayer) {
    const maxLabels = getMaxLabelsPerLayer(layerIndex as LayerIndex, zoom)
    // Sort by amount (descending) and take top N
    const topNodes = [...layerNodes]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, maxLabels)

    if (topNodes.length === 0) continue

    const fontSize = getLabelSize(layerIndex as LayerIndex, zoom)

    // Calculate font size in world coordinates
    // At zoom 0, 1 world unit = 1 pixel. At zoom N, scale = 2^N
    const scale = Math.pow(2, zoom)
    const worldFontSize = fontSize / scale

    layers.push(
      new TextLayer<LayoutNode>({
        id: `labels-layer-${layerIndex}`,
        data: topNodes,
        pickable: false,

        getText: (d) => d.name,
        getPosition: (d) => [d.x + d.width / 2 + 10 / scale, d.y], // Right of node with offset
        getSize: worldFontSize,
        getColor: (d) => {
          // Reduce opacity for non-connected nodes when there's an active selection
          if (hasActiveSelection && !connectedNodeIds.has(d.id)) {
            return [255, 255, 255, 51] // 20% opacity
          }
          return [255, 255, 255, 220] // Slightly transparent white
        },
        getAngle: 0,
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontWeight: 'normal',

        // Use world coordinates (common units)
        sizeUnits: 'common',
        sizeScale: 1,

        updateTriggers: {
          getData: [zoom],
          getSize: [zoom],
          getPosition: [zoom],
          getColor: [hoveredNodeId, selectedNodeId, connectedNodeIds],
        },
      })
    )
  }

  return layers
}

import { PolygonLayer } from '@deck.gl/layers'
import type { LayoutNode } from '@/types/layout'
import { getNodeColor } from '@/utils/colorScheme'

/**
 * Create PolygonLayers for nodes as vertical bars (Sankey-style)
 */
export function createNodeLayers(
  nodes: LayoutNode[],
  hoveredNodeId: string | null,
  selectedNodeId: string | null,
  connectedNodeIds: Set<string>
): PolygonLayer<LayoutNode>[] {
  const hasActiveSelection = !!(hoveredNodeId || selectedNodeId)
  // Group nodes by layer
  const nodesByLayer = new Map<number, LayoutNode[]>()

  for (const node of nodes) {
    const layerNodes = nodesByLayer.get(node.layer) || []
    layerNodes.push(node)
    nodesByLayer.set(node.layer, layerNodes)
  }

  // Create a layer for each group
  const layers: PolygonLayer<LayoutNode>[] = []

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

        // Stroke - highlight selected node with bright stroke
        stroked: true,
        getLineColor: (d) => {
          if (d.id === selectedNodeId) {
            return [255, 200, 0, 255] as [number, number, number, number] // Bright gold stroke for selected
          }
          return [255, 255, 255, 100] as [number, number, number, number] // Default white stroke
        },
        getLineWidth: (d) => {
          if (d.id === selectedNodeId) {
            return 3 // Thicker stroke for selected
          }
          return 1
        },
        lineWidthMinPixels: 1,
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

  return layers
}

import { PolygonLayer } from '@deck.gl/layers'
import type { LayoutNode } from '@/types/layout'
import { getNodeColor } from '@/utils/colorScheme'

/**
 * Create PolygonLayers for nodes as vertical bars (Sankey-style)
 */
export function createNodeLayers(
  nodes: LayoutNode[],
  hoveredNodeId: string | null,
  selectedNodeId: string | null
): PolygonLayer<LayoutNode>[] {
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

        // Fill color with hover/selection highlighting
        getFillColor: (d) => {
          if (d.id === selectedNodeId) {
            return [255, 200, 0, 255] // Gold for selected
          }
          if (d.id === hoveredNodeId) {
            return [255, 255, 255, 255] // White for hovered
          }
          return getNodeColor(d)
        },

        // Stroke
        stroked: true,
        getLineColor: [255, 255, 255, 100],
        getLineWidth: 1,
        lineWidthMinPixels: 1,
        lineWidthMaxPixels: 2,

        // Performance: only update colors when selection changes
        updateTriggers: {
          getFillColor: [hoveredNodeId, selectedNodeId],
        },
      })
    )
  }

  return layers
}

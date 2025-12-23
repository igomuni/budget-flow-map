import { ScatterplotLayer } from '@deck.gl/layers'
import type { LayoutNode } from '@/types/layout'
import { getNodeColor, getNodeRadius } from '@/utils/colorScheme'

/**
 * Create ScatterplotLayers for nodes, grouped by layer type
 */
export function createNodeLayers(
  nodes: LayoutNode[],
  hoveredNodeId: string | null,
  selectedNodeId: string | null
): ScatterplotLayer<LayoutNode>[] {
  // Group nodes by layer
  const nodesByLayer = new Map<number, LayoutNode[]>()

  for (const node of nodes) {
    const layerNodes = nodesByLayer.get(node.layer) || []
    layerNodes.push(node)
    nodesByLayer.set(node.layer, layerNodes)
  }

  // Create a layer for each group
  const layers: ScatterplotLayer<LayoutNode>[] = []

  for (const [layerIndex, layerNodes] of nodesByLayer) {
    layers.push(
      new ScatterplotLayer<LayoutNode>({
        id: `nodes-layer-${layerIndex}`,
        data: layerNodes,
        pickable: true,

        // Position
        getPosition: (d) => [d.x, d.y],

        // Size
        getRadius: (d) => getNodeRadius(d),
        radiusMinPixels: 2,
        radiusMaxPixels: 50,
        radiusScale: 1,

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
        lineWidthMinPixels: 1,

        // Performance: only update colors when selection changes
        updateTriggers: {
          getFillColor: [hoveredNodeId, selectedNodeId],
        },
      })
    )
  }

  return layers
}

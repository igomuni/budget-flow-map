import { PathLayer } from '@deck.gl/layers'
import type { LayoutEdge } from '@/types/layout'

/**
 * Create PathLayer for edges with Sankey-style curves
 */
export function createEdgeLayers(
  edges: LayoutEdge[],
  connectedEdges: Set<string>,
  hasActiveSelection: boolean
): PathLayer<LayoutEdge>[] {
  return [
    new PathLayer<LayoutEdge>({
      id: 'edges-layer',
      data: edges,
      pickable: false, // Edges not directly clickable

      // Path from pre-computed Bezier points
      getPath: (d) => d.path,

      // Sankey principle: Flow width = actual flow amount
      // edge.width is already calculated based on flow value
      getWidth: (d) => d.width,
      widthMinPixels: 0.1,
      // No widthMaxPixels - let flows scale naturally like node heights
      widthScale: 1,

      // Sankey color: Semi-transparent fills that blend when overlapping
      getColor: (d) => {
        // Neutral gray-blue that shows flow overlaps clearly
        const sankeyBlue: [number, number, number] = [130, 160, 200]

        if (!hasActiveSelection) {
          // Default: 30% opacity - allows seeing overlaps
          return [...sankeyBlue, 77] as [number, number, number, number]
        }

        if (connectedEdges.has(d.id)) {
          // Highlighted: 70% opacity, vibrant blue
          return [80, 140, 255, 179] as [number, number, number, number]
        }

        // Background: 10% opacity (very faint)
        return [...sankeyBlue, 26] as [number, number, number, number]
      },

      // Flat caps: edges should align flush with node edges (Sankey standard)
      capRounded: false,
      jointRounded: true, // Keep rounded joints for smooth curves

      // Performance
      updateTriggers: {
        getColor: [connectedEdges, hasActiveSelection],
      },
    }),
  ]
}

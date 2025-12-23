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

      // Width based on flow value
      getWidth: (d) => Math.max(d.width, 0.5),
      widthMinPixels: 0.5,
      widthMaxPixels: 30,
      widthScale: 1,

      // Color with opacity variation for highlighting
      getColor: (d) => {
        // Default color (gray-blue)
        const baseColor: [number, number, number] = [100, 130, 180]

        if (!hasActiveSelection) {
          // Default 30% opacity
          return [...baseColor, 77] as [number, number, number, number]
        }

        if (connectedEdges.has(d.id)) {
          // Connected: 100% opacity, brighter
          return [150, 180, 220, 255] as [number, number, number, number]
        }

        // Non-related: 10% opacity
        return [...baseColor, 26] as [number, number, number, number]
      },

      // Rounded caps for smoother appearance
      capRounded: true,
      jointRounded: true,

      // Performance
      updateTriggers: {
        getColor: [connectedEdges, hasActiveSelection],
      },
    }),
  ]
}

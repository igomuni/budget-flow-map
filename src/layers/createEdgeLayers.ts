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

      // Width based on flow value (wider for Sankey-style visualization)
      getWidth: (d) => Math.max(d.width * 2, 1), // 2x wider for better visibility
      widthMinPixels: 1,
      widthMaxPixels: 100, // Allow wider flows
      widthScale: 1,

      // Color with opacity variation for highlighting
      getColor: (d) => {
        // Default color (semi-transparent gray-blue)
        const baseColor: [number, number, number] = [100, 130, 180]

        if (!hasActiveSelection) {
          // Default 40% opacity (slightly higher for Sankey)
          return [...baseColor, 102] as [number, number, number, number]
        }

        if (connectedEdges.has(d.id)) {
          // Connected: 80% opacity, brighter
          return [150, 180, 220, 204] as [number, number, number, number]
        }

        // Non-related: 15% opacity
        return [...baseColor, 38] as [number, number, number, number]
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

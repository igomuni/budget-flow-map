import type { LayoutNode, LayoutEdge } from '@/types/layout'

/**
 * Viewport bounds in world coordinates
 */
export interface ViewportBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Calculate viewport bounds from OrthographicViewState
 * @param target - Center point [x, y]
 * @param zoom - Zoom level (log2 scale)
 * @param width - Viewport width in pixels
 * @param height - Viewport height in pixels
 * @param padding - Extra padding as a ratio (0.2 = 20% padding)
 */
export function calculateViewportBounds(
  target: [number, number] | number[],
  zoom: number | [number, number],
  width: number,
  height: number,
  padding: number = 0.2
): ViewportBounds {
  // Handle zoom array (OrthographicView can have [zoomX, zoomY])
  const zoomValue = Array.isArray(zoom) ? zoom[0] : zoom

  // Scale factor: at zoom 0, 1 world unit = 1 pixel
  // At zoom N, scale = 2^N
  const scale = Math.pow(2, zoomValue)

  // Half dimensions in world coordinates
  const halfWidth = (width / scale) / 2
  const halfHeight = (height / scale) / 2

  // Add padding to ensure smooth transitions
  const paddedHalfWidth = halfWidth * (1 + padding)
  const paddedHalfHeight = halfHeight * (1 + padding)

  return {
    minX: target[0] - paddedHalfWidth,
    maxX: target[0] + paddedHalfWidth,
    minY: target[1] - paddedHalfHeight,
    maxY: target[1] + paddedHalfHeight,
  }
}

/**
 * Check if a node intersects with the viewport bounds
 */
export function isNodeInViewport(node: LayoutNode, bounds: ViewportBounds): boolean {
  const nodeMinX = node.x - node.width / 2
  const nodeMaxX = node.x + node.width / 2
  const nodeMinY = node.y - node.height / 2
  const nodeMaxY = node.y + node.height / 2

  // Check for intersection (not complete containment)
  return !(
    nodeMaxX < bounds.minX ||
    nodeMinX > bounds.maxX ||
    nodeMaxY < bounds.minY ||
    nodeMinY > bounds.maxY
  )
}

/**
 * Check if an edge intersects with the viewport bounds
 * Uses bounding box of the edge path for quick check
 */
export function isEdgeInViewport(edge: LayoutEdge, bounds: ViewportBounds): boolean {
  if (edge.path.length === 0) return false

  // Calculate bounding box of edge path
  let pathMinX = Infinity
  let pathMaxX = -Infinity
  let pathMinY = Infinity
  let pathMaxY = -Infinity

  for (const point of edge.path) {
    if (point[0] < pathMinX) pathMinX = point[0]
    if (point[0] > pathMaxX) pathMaxX = point[0]
    if (point[1] < pathMinY) pathMinY = point[1]
    if (point[1] > pathMaxY) pathMaxY = point[1]
  }

  // Check for intersection
  return !(
    pathMaxX < bounds.minX ||
    pathMinX > bounds.maxX ||
    pathMaxY < bounds.minY ||
    pathMinY > bounds.maxY
  )
}

/**
 * Filter nodes to only those visible in the viewport
 */
export function cullNodes(nodes: LayoutNode[], bounds: ViewportBounds): LayoutNode[] {
  return nodes.filter(node => isNodeInViewport(node, bounds))
}

/**
 * Filter edges to only those visible in the viewport
 */
export function cullEdges(edges: LayoutEdge[], bounds: ViewportBounds): LayoutEdge[] {
  return edges.filter(edge => isEdgeInViewport(edge, bounds))
}

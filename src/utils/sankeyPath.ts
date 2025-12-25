/**
 * Generate smooth Bezier curve path for Sankey diagram links
 *
 * Sankey diagrams use horizontal cubic Bezier curves:
 * - Control points are positioned horizontally from source/target
 * - Creates the characteristic "S-curve" flow appearance
 */

/**
 * Generate Sankey-style Bezier curve path between two nodes
 *
 * @param sourceX - X coordinate of source node edge
 * @param sourceY - Y coordinate of source node center
 * @param targetX - X coordinate of target node edge
 * @param targetY - Y coordinate of target node center
 * @returns Array of [x, y] points forming a smooth Bezier curve
 */
export function generateSankeyPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): [number, number][] {
  // Horizontal distance between nodes
  const dx = targetX - sourceX

  // Control point offset (typically ~40% of horizontal distance)
  const controlPointOffset = dx * 0.4

  // Cubic Bezier curve with 4 control points:
  // P0: source point
  // P1: control point 1 (horizontal from source)
  // P2: control point 2 (horizontal from target)
  // P3: target point

  const p0: [number, number] = [sourceX, sourceY]
  const p1: [number, number] = [sourceX + controlPointOffset, sourceY]
  const p2: [number, number] = [targetX - controlPointOffset, targetY]
  const p3: [number, number] = [targetX, targetY]

  // Generate smooth curve points using cubic Bezier interpolation
  const segments = 20 // Number of segments for smooth curve
  const path: [number, number][] = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const point = cubicBezier(p0, p1, p2, p3, t)
    path.push(point)
  }

  return path
}

/**
 * Cubic Bezier interpolation
 * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
function cubicBezier(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] {
  const t2 = t * t
  const t3 = t2 * t
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt

  const x = mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0]
  const y = mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1]

  return [x, y]
}

import type { LayoutNode, LayerIndex } from '@/types/layout'

/**
 * Zoom threshold for each layer to show labels
 * Uses log2 scale (zoom level in deck.gl OrthographicView)
 *
 * Initial zoom is -4 (very zoomed out)
 * Zoom -4 = 1/16x (initial view)
 * Zoom -3 = 1/8x
 * Zoom -2 = 1/4x
 * Zoom -1 = 1/2x
 * Zoom 0 = 1x
 * Zoom 1 = 2x
 * Zoom 2 = 4x
 */
const LABEL_VISIBILITY_THRESHOLDS: Record<LayerIndex, number> = {
  0: -3,      // Ministry: visible at ~1/8x zoom (early)
  1: -2,      // Bureau: visible at ~1/4x zoom
  2: -1,      // Division: visible at ~1/2x zoom
  3: 0,       // Project: visible at 1x zoom
  4: 1,       // Recipient: visible at 2x zoom
}

/**
 * Check if a node's label should be visible at the current zoom level
 */
export function isLabelVisible(node: LayoutNode, zoom: number): boolean {
  const threshold = LABEL_VISIBILITY_THRESHOLDS[node.layer]
  return zoom >= threshold
}

/**
 * Filter nodes to only those whose labels should be visible
 */
export function getVisibleLabels(nodes: LayoutNode[], zoom: number): LayoutNode[] {
  return nodes.filter(node => isLabelVisible(node, zoom))
}

/**
 * Get label font size based on layer and zoom
 * Returns size in pixels (will be converted to world units by caller)
 */
export function getLabelSize(layer: LayerIndex, zoom: number): number {
  const baseSizes: Record<LayerIndex, number> = {
    0: 14,   // Ministry: largest
    1: 12,   // Bureau
    2: 11,   // Division
    3: 10,   // Project
    4: 9,    // Recipient: smallest
  }

  // Slightly increase size as zoom increases (capped)
  const zoomBonus = Math.min(4, Math.max(0, zoom - LABEL_VISIBILITY_THRESHOLDS[layer]) * 1.5)

  return baseSizes[layer] + zoomBonus
}

/**
 * Get maximum number of labels to show per layer at current zoom
 * Prevents visual overload at low zoom levels
 */
export function getMaxLabelsPerLayer(layer: LayerIndex, zoom: number): number {
  const baseMax: Record<LayerIndex, number> = {
    0: 50,    // Show all ministries
    1: 30,    // Bureaus limited
    2: 100,   // Divisions more limited
    3: 200,   // Projects very limited
    4: 100,   // Recipients limited
  }

  // Increase limit as zoom increases
  const zoomMultiplier = Math.pow(2, Math.max(0, zoom - 1))

  return Math.floor(baseMax[layer] * zoomMultiplier)
}

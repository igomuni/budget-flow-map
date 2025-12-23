import type { LayoutNode, LayerIndex } from '@/types/layout'

/**
 * Zoom threshold for each layer to show labels
 * Uses log2 scale (zoom level in deck.gl OrthographicView)
 *
 * Zoom 0 = 1x
 * Zoom 1 = 2x
 * Zoom 2 = 4x
 * Zoom 2.32 = 5x
 */
const LABEL_VISIBILITY_THRESHOLDS: Record<LayerIndex, number> = {
  0: -1,      // Ministry: always visible (even at 0.5x zoom)
  1: 0.5,     // Bureau: visible at ~1.4x zoom
  2: 1.5,     // Division: visible at ~2.8x zoom
  3: 2.2,     // Project: visible at ~4.6x zoom
  4: 2.5,     // Recipient: visible at ~5.6x zoom
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
 */
export function getLabelSize(layer: LayerIndex, zoom: number): number {
  const baseSizes: Record<LayerIndex, number> = {
    0: 16,   // Ministry: largest
    1: 14,   // Bureau
    2: 12,   // Division
    3: 10,   // Project
    4: 9,    // Recipient: smallest
  }

  // Slightly increase size as zoom increases
  const zoomBonus = Math.max(0, zoom - LABEL_VISIBILITY_THRESHOLDS[layer]) * 2

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

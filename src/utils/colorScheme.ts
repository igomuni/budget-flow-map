import type { LayoutNode, LayerIndex } from '@/types/layout'

/**
 * Ministry base colors (RGB)
 * Each ministry has a distinct hue for visual identification
 */
const MINISTRY_COLORS: Record<string, [number, number, number]> = {
  '厚生労働省': [66, 133, 244],    // Blue
  '国土交通省': [52, 168, 83],     // Green
  '文部科学省': [251, 188, 4],     // Yellow
  '経済産業省': [234, 67, 53],     // Red
  '農林水産省': [139, 195, 74],    // Light green
  '防衛省': [96, 125, 139],        // Blue gray
  '総務省': [156, 39, 176],        // Purple
  '財務省': [255, 152, 0],         // Orange
  '法務省': [0, 150, 136],         // Teal
  '外務省': [63, 81, 181],         // Indigo
  '環境省': [76, 175, 80],         // Green
  '内閣府': [121, 85, 72],         // Brown
  'デジタル庁': [0, 188, 212],     // Cyan
  'こども家庭庁': [255, 87, 34],   // Deep orange
  '復興庁': [103, 58, 183],        // Deep purple
  'default': [158, 158, 158],      // Gray
}

/**
 * Saturation multiplier by layer
 * Higher layers (detail) have lower saturation
 */
const SATURATION_BY_LAYER: Record<LayerIndex, number> = {
  0: 1.0,    // Ministry: full saturation
  1: 0.9,    // Bureau: slightly reduced
  2: 0.8,    // Division: more reduced
  3: 0.7,    // Project: even more reduced
  4: 0.6,    // Recipient: most reduced
}

/**
 * Get the base color for a ministry
 */
export function getMinistryColor(ministryId: string): [number, number, number] {
  return MINISTRY_COLORS[ministryId] || MINISTRY_COLORS['default']
}

/**
 * Get the fill color for a node (RGBA)
 * Color varies by ministry (hue) and layer (saturation)
 * Layer 4 (recipients) use a distinct red color palette
 * "Other" (aggregated) nodes use a distinct purple color
 */
export function getNodeColor(node: LayoutNode): [number, number, number, number] {
  // "Other" (aggregated) nodes use distinct purple to stand out
  if (node.metadata?.isOther) {
    return [156, 39, 176, 200] // Purple with slight transparency
  }

  // Layer 4 (recipients) use vibrant red tones to stand out
  if (node.layer === 4) {
    return [244, 67, 54, 255] // Vibrant red (Material Design Red 500)
  }

  // Layer 0-3 must have ministryId
  if (!node.ministryId) {
    return [128, 128, 128, 255] // Fallback gray
  }

  const baseColor = getMinistryColor(node.ministryId)
  const saturationMultiplier = SATURATION_BY_LAYER[node.layer]

  // Apply saturation reduction (blend toward gray)
  const gray = 128
  const r = Math.round(baseColor[0] * saturationMultiplier + gray * (1 - saturationMultiplier))
  const g = Math.round(baseColor[1] * saturationMultiplier + gray * (1 - saturationMultiplier))
  const b = Math.round(baseColor[2] * saturationMultiplier + gray * (1 - saturationMultiplier))

  return [r, g, b, 255]
}


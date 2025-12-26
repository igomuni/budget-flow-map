/**
 * Node types in the 5-layer Sankey DAG
 */
export type NodeType = 'ministry' | 'bureau' | 'division' | 'project' | 'recipient'

/**
 * Layer indices for the 5-layer structure
 * Layer 0: Ministry (府省)
 * Layer 1: Bureau (局)
 * Layer 2: Division (課)
 * Layer 3: Project (事業)
 * Layer 4: Recipient (支出先)
 */
export type LayerIndex = 0 | 1 | 2 | 3 | 4

/**
 * Node metadata varies by node type
 */
export interface NodeMetadata {
  // Project-specific
  projectId?: string
  executionRate?: number
  hierarchyPath?: string[]

  // Recipient-specific
  corporateNumber?: string
  location?: string
  corporateType?: string
  sourceMinistries?: string[]  // 支出元府省庁リスト（複数府省から支出を受ける場合）

  // Aggregation metadata (for "Other" nodes)
  isOther?: boolean
  aggregatedCount?: number
  aggregatedIds?: string[]
}

/**
 * A node in the layout with pre-computed position
 */
export interface LayoutNode {
  id: string
  type: NodeType
  layer: LayerIndex
  name: string
  amount: number
  ministryId?: string  // Optional: 支出先（Layer 4）では使用しない
  x: number        // Center X coordinate
  y: number        // Center Y coordinate
  width: number    // Node rectangle width
  height: number   // Node rectangle height
  metadata: NodeMetadata
}

/**
 * An edge in the layout with pre-computed Bezier path
 */
export interface LayoutEdge {
  id: string
  sourceId: string
  targetId: string
  value: number
  width: number           // Stroke width based on value
  path: [number, number][]  // Pre-computed Bezier path points [[x,y], ...]
}

/**
 * Bounding box for the entire layout
 */
export interface LayoutBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * TopN aggregation settings
 */
export interface TopNSettings {
  projects: number
  recipients: number
}

/**
 * Metadata about the layout
 */
export interface LayoutMetadata {
  generatedAt: string
  fiscalYear: number
  nodeCount: number
  edgeCount: number
  canvasWidth: number
  canvasHeight: number
  topNSettings?: TopNSettings
}

/**
 * Complete layout data structure loaded from JSON
 */
export interface LayoutData {
  metadata: LayoutMetadata
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  bounds: LayoutBounds
}

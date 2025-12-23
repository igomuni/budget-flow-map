import type { LayoutNode } from './layout'

/**
 * OrthographicView state for deck.gl
 */
export interface ViewState {
  target: [number, number]
  zoom: number
  minZoom: number
  maxZoom: number
}

/**
 * Info panel tab types
 */
export type InfoPanelTab = 'basic' | 'recipients' | 'flow'

/**
 * Complete store state interface
 */
export interface StoreState {
  // View state
  viewState: ViewState
  setViewState: (viewState: ViewState) => void
  resetViewState: () => void
  zoomTo: (target: { x: number; y: number; zoom?: number }) => void

  // Selection state
  hoveredNodeId: string | null
  selectedNodeId: string | null
  selectedNodeData: LayoutNode | null
  setHoveredNode: (nodeId: string | null) => void
  setSelectedNode: (nodeId: string | null, nodeData?: LayoutNode | null) => void
  clearSelection: () => void

  // UI state
  isInfoPanelOpen: boolean
  activeTab: InfoPanelTab
  tooltipPosition: { x: number; y: number } | null
  tooltipContent: string | null
  openInfoPanel: () => void
  closeInfoPanel: () => void
  setActiveTab: (tab: InfoPanelTab) => void
  showTooltip: (x: number, y: number, content: string) => void
  hideTooltip: () => void
}

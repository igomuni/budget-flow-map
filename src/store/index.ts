import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { StoreState, ViewState, InfoPanelTab } from '@/types/store'
import type { LayoutNode } from '@/types/layout'

const INITIAL_VIEW_STATE: ViewState = {
  target: [0, 0],
  zoom: 0,
  minZoom: -2,
  maxZoom: 6,
}

export const useStore = create<StoreState>()(
  devtools(
    (set) => ({
      // View state
      viewState: INITIAL_VIEW_STATE,
      setViewState: (viewState: ViewState) => set({ viewState }),
      resetViewState: () => set({ viewState: INITIAL_VIEW_STATE }),
      zoomTo: ({ x, y, zoom }) =>
        set((state) => ({
          viewState: {
            ...state.viewState,
            target: [x, y],
            zoom: zoom ?? state.viewState.zoom + 1,
          },
        })),

      // Selection state
      hoveredNodeId: null,
      selectedNodeId: null,
      selectedNodeData: null,
      setHoveredNode: (nodeId: string | null) => set({ hoveredNodeId: nodeId }),
      setSelectedNode: (nodeId: string | null, nodeData?: LayoutNode | null) =>
        set({
          selectedNodeId: nodeId,
          selectedNodeData: nodeData ?? null,
          isInfoPanelOpen: nodeId !== null,
        }),
      clearSelection: () =>
        set({
          selectedNodeId: null,
          selectedNodeData: null,
          isInfoPanelOpen: false,
        }),

      // UI state
      isInfoPanelOpen: false,
      activeTab: 'basic' as InfoPanelTab,
      tooltipPosition: null,
      tooltipContent: null,
      openInfoPanel: () => set({ isInfoPanelOpen: true }),
      closeInfoPanel: () => set({ isInfoPanelOpen: false }),
      setActiveTab: (tab: InfoPanelTab) => set({ activeTab: tab }),
      showTooltip: (x: number, y: number, content: string) =>
        set({ tooltipPosition: { x, y }, tooltipContent: content }),
      hideTooltip: () => set({ tooltipPosition: null, tooltipContent: null }),
    }),
    { name: 'budget-flow-map' }
  )
)

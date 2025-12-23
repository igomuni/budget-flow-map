import { useState, useCallback } from 'react'
import type { OrthographicViewState } from '@deck.gl/core'
import { useLayoutData } from '@/hooks/useLayoutData'
import { DeckGLCanvas } from './DeckGLCanvas'
import { Minimap } from './Minimap'

export function BudgetFlowMap() {
  const { data, loading, error } = useLayoutData()
  const [viewState, setViewState] = useState<OrthographicViewState | null>(null)
  const [navigateTarget, setNavigateTarget] = useState<[number, number] | null>(null)

  const handleViewStateChange = useCallback((vs: OrthographicViewState) => {
    setViewState(vs)
  }, [])

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
    setNavigateTarget([x, y])
    // Reset after a tick to allow re-navigation to same spot
    setTimeout(() => setNavigateTarget(null), 100)
  }, [])

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4 mx-auto"></div>
          <p className="text-slate-400">Loading budget flow data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2">Error loading data</p>
          <p className="text-slate-500 text-sm">{error.message}</p>
          <p className="text-slate-600 text-xs mt-4">
            Make sure layout.json exists in public/data/
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900">
        <p className="text-slate-500">No data available</p>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <DeckGLCanvas
        layoutData={data}
        onViewStateChange={handleViewStateChange}
        externalTarget={navigateTarget}
      />
      {viewState && (
        <Minimap
          layoutData={data}
          viewState={viewState}
          onNavigate={handleMinimapNavigate}
        />
      )}
    </div>
  )
}

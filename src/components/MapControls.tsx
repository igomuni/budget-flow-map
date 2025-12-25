import { useCallback } from 'react'

interface MapControlsProps {
  zoom: number
  minZoom: number
  maxZoom: number
  onZoomChange: (zoom: number) => void
  nodeSpacingX: number
  nodeSpacingY: number
  nodeWidth: number
  onNodeSpacingXChange: (spacing: number) => void
  onNodeSpacingYChange: (spacing: number) => void
  onNodeWidthChange: (width: number) => void
  onFitToScreen: () => void
}

export function MapControls({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
  nodeSpacingX,
  nodeSpacingY,
  nodeWidth,
  onNodeSpacingXChange,
  onNodeSpacingYChange,
  onNodeWidthChange,
  onFitToScreen,
}: MapControlsProps) {
  const handleZoomIn = useCallback(() => {
    onZoomChange(Math.min(zoom + 0.5, maxZoom))
  }, [zoom, maxZoom, onZoomChange])

  const handleZoomOut = useCallback(() => {
    onZoomChange(Math.max(zoom - 0.5, minZoom))
  }, [zoom, minZoom, onZoomChange])

  const handleZoomSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onZoomChange(parseFloat(e.target.value))
    },
    [onZoomChange]
  )

  const handleSpacingXSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNodeSpacingXChange(parseFloat(e.target.value))
    },
    [onNodeSpacingXChange]
  )

  const handleSpacingYSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNodeSpacingYChange(parseFloat(e.target.value))
    },
    [onNodeSpacingYChange]
  )

  const handleNodeWidthSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNodeWidthChange(parseFloat(e.target.value))
    },
    [onNodeWidthChange]
  )

  // Reset spacing to default
  const handleResetSpacing = useCallback(() => {
    onNodeSpacingXChange(0)
    onNodeSpacingYChange(0)
    onNodeWidthChange(50) // デフォルト幅
  }, [onNodeSpacingXChange, onNodeSpacingYChange, onNodeWidthChange])

  // Format spacing value for display
  const formatSpacing = (value: number) => {
    return `${Math.round(value)}px`
  }

  // Handle direct input for spacing X
  const handleSpacingXInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 0
      onNodeSpacingXChange(Math.max(0, Math.min(100, value)))
    },
    [onNodeSpacingXChange]
  )

  // Handle direct input for spacing Y
  const handleSpacingYInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 0
      onNodeSpacingYChange(Math.max(0, Math.min(100, value)))
    },
    [onNodeSpacingYChange]
  )

  // Handle direct input for node width
  const handleNodeWidthInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value) || 10
      onNodeWidthChange(Math.max(10, Math.min(200, value)))
    },
    [onNodeWidthChange]
  )

  // Handle direct input for zoom (in percentage)
  // zoom = 0 means 100% (1px = 1px)
  const handleZoomInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const percentage = parseFloat(e.target.value)
      if (!isNaN(percentage)) {
        // percentage = 100 * 2^zoom → zoom = log2(percentage / 100)
        const zoomValue = Math.log2(percentage / 100)
        onZoomChange(Math.max(minZoom, Math.min(maxZoom, zoomValue)))
      }
    },
    [onZoomChange, minZoom, maxZoom]
  )

  // Convert zoom to percentage for display (zoom=0 → 100%)
  const zoomPercentage = Math.round(Math.pow(2, zoom) * 100)

  return (
    <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-1">
      {/* Zoom Controls - horizontal slider with magnifying glass */}
      <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg p-2 flex items-center gap-2">
        <button
          onClick={handleZoomOut}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded transition-colors"
          title="Zoom out"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6" />
          </svg>
        </button>
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.1}
          value={zoom}
          onChange={handleZoomSlider}
          className="w-20 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
          title={`Zoom: ${zoom.toFixed(1)}`}
        />
        <input
          type="number"
          min={1}
          max={6400}
          step={1}
          value={zoomPercentage}
          onChange={handleZoomInput}
          className="w-12 px-1 py-0.5 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400">%</span>
        <button
          onClick={handleZoomIn}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded transition-colors"
          title="Zoom in"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M11 8v6M8 11h6" />
          </svg>
        </button>
        <button
          onClick={onFitToScreen}
          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-gray-100 active:bg-gray-200 rounded transition-colors ml-1 border-l border-gray-200 pl-2"
          title="Fit to screen"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
          </svg>
        </button>
      </div>

      {/* Horizontal spacing */}
      <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg p-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12H3M21 12l-4-4M21 12l-4 4M3 12l4-4M3 12l4 4" />
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={nodeSpacingX}
          onChange={handleSpacingXSlider}
          className="w-20 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
          title={`追加間隔（横）: ${formatSpacing(nodeSpacingX)}`}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(nodeSpacingX)}
          onChange={handleSpacingXInput}
          className="w-12 px-1 py-0.5 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400">px</span>
      </div>

      {/* Vertical spacing */}
      <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg p-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18M12 3l-4 4M12 3l4 4M12 21l-4-4M12 21l4-4" />
        </svg>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={nodeSpacingY}
          onChange={handleSpacingYSlider}
          className="w-20 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
          title={`追加間隔（縦）: ${formatSpacing(nodeSpacingY)}`}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(nodeSpacingY)}
          onChange={handleSpacingYInput}
          className="w-12 px-1 py-0.5 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400">px</span>
        <button
          onClick={handleResetSpacing}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Reset spacing"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </div>

      {/* Node width */}
      <div className="bg-white/95 backdrop-blur rounded-lg shadow-lg p-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="4" width="12" height="16" rx="2" />
        </svg>
        <input
          type="range"
          min={10}
          max={200}
          step={5}
          value={nodeWidth}
          onChange={handleNodeWidthSlider}
          className="w-20 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
          title={`Node width: ${formatSpacing(nodeWidth)}`}
        />
        <input
          type="number"
          min={10}
          max={200}
          value={Math.round(nodeWidth)}
          onChange={handleNodeWidthInput}
          className="w-12 px-1 py-0.5 text-xs text-right text-gray-900 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-xs text-gray-400">px</span>
      </div>
    </div>
  )
}

import { useCallback, useState } from 'react'
import { captureScreenshotWithTimestamp } from '@/utils/exportScreenshot'

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
  const [showSettings, setShowSettings] = useState(false)

  const handleZoomIn = useCallback(() => {
    onZoomChange(Math.min(zoom + 0.5, maxZoom))
  }, [zoom, maxZoom, onZoomChange])

  const handleZoomOut = useCallback(() => {
    onZoomChange(Math.max(zoom - 0.5, minZoom))
  }, [zoom, minZoom, onZoomChange])

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
    onNodeWidthChange(50)
  }, [onNodeSpacingXChange, onNodeSpacingYChange, onNodeWidthChange])

  // Convert zoom to percentage for display (zoom=0 → 100%)
  const zoomPercentage = Math.round(Math.pow(2, zoom) * 100)

  return (
    <>
      {/* Main zoom controls - bottom right, Google Maps style */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1">
        {/* Zoom In/Out buttons */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors border-b border-gray-200"
            title="ズームイン"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            title="ズームアウト"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Fit to screen button */}
        <button
          onClick={onFitToScreen}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="全体を表示"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
          </svg>
        </button>

        {/* Screenshot button */}
        <button
          onClick={captureScreenshotWithTimestamp}
          className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          title="スクリーンショット"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </button>

        {/* Settings toggle button */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center transition-colors ${
            showSettings ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="レイアウト設定"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      {/* Settings panel - slides up from settings button */}
      {showSettings && (
        <div className="absolute bottom-[200px] right-4 z-20 bg-white rounded-lg shadow-lg p-4 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800">レイアウト設定</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Zoom display */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                ズーム: {zoomPercentage}%
              </label>
              <input
                type="range"
                min={minZoom}
                max={maxZoom}
                step={0.1}
                value={zoom}
                onChange={(e) => onZoomChange(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
              />
            </div>

            {/* Horizontal spacing */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                横間隔: {Math.round(nodeSpacingX)}px
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={nodeSpacingX}
                onChange={handleSpacingXSlider}
                className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
              />
            </div>

            {/* Vertical spacing */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                縦間隔: {Math.round(nodeSpacingY)}px
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={nodeSpacingY}
                onChange={handleSpacingYSlider}
                className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
              />
            </div>

            {/* Node width */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                ノード幅: {Math.round(nodeWidth)}px
              </label>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={nodeWidth}
                onChange={handleNodeWidthSlider}
                className="w-full h-1 appearance-none bg-gray-200 rounded-full cursor-pointer accent-blue-500"
              />
            </div>

            {/* Reset button */}
            <button
              onClick={handleResetSpacing}
              className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors"
            >
              リセット
            </button>
          </div>
        </div>
      )}
    </>
  )
}

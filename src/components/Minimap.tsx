import { useCallback, useMemo, useRef, useEffect, useState } from 'react'
import type { OrthographicViewState } from '@deck.gl/core'
import type { LayoutData } from '@/types/layout'

interface MinimapProps {
  layoutData: LayoutData
  viewState: OrthographicViewState
  onNavigate: (x: number, y: number) => void
  width?: number
}

export function Minimap({
  layoutData,
  viewState,
  onNavigate,
  width = 120,
}: MinimapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const { bounds, nodes } = layoutData

  // Measure container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const h = containerRef.current.clientHeight
        if (h > 0) {
          setContainerHeight(h)
        }
      }
    }
    // Initial measurement after mount
    const timer = setTimeout(updateHeight, 50)
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateHeight)
    }
  }, [])

  const canvasHeight = Math.max(containerHeight - 28, 100)

  // Calculate scale to fit bounds in minimap
  const scale = useMemo(() => {
    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY
    const scaleX = (width - 20) / boundsWidth
    const scaleY = (canvasHeight - 20) / boundsHeight
    return Math.min(scaleX, scaleY)
  }, [bounds, width, canvasHeight])

  // Convert world coords to minimap coords
  const worldToMinimap = useCallback(
    (worldX: number, worldY: number): [number, number] => {
      const x = (worldX - bounds.minX) * scale + 10
      const y = (worldY - bounds.minY) * scale + 10
      return [x, y]
    },
    [bounds, scale]
  )

  // Convert minimap coords to world coords
  const minimapToWorld = useCallback(
    (minimapX: number, minimapY: number): [number, number] => {
      const worldX = (minimapX - 10) / scale + bounds.minX
      const worldY = (minimapY - 10) / scale + bounds.minY
      return [worldX, worldY]
    },
    [bounds, scale]
  )

  // Calculate viewport rectangle on minimap
  const viewportRect = useMemo(() => {
    const zoom = typeof viewState.zoom === 'number' ? viewState.zoom : 0
    const zoomFactor = Math.pow(2, zoom)
    const viewportWorldWidth = 1200 / zoomFactor
    const viewportWorldHeight = 800 / zoomFactor

    const target = viewState.target ?? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]
    const centerX = target[0]
    const centerY = target[1]

    const [left, top] = worldToMinimap(
      centerX - viewportWorldWidth / 2,
      centerY - viewportWorldHeight / 2
    )
    const [right, bottom] = worldToMinimap(
      centerX + viewportWorldWidth / 2,
      centerY + viewportWorldHeight / 2
    )

    return {
      x: Math.max(0, left),
      y: Math.max(0, top),
      width: Math.min(width, right - left),
      height: Math.min(canvasHeight, bottom - top),
    }
  }, [viewState, worldToMinimap, width, canvasHeight, bounds])

  // Handle click on minimap
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const minimapX = (e.clientX - rect.left) * scaleX
      const minimapY = (e.clientY - rect.top) * scaleY

      const [worldX, worldY] = minimapToWorld(minimapX, minimapY)
      onNavigate(worldX, worldY)
    },
    [minimapToWorld, onNavigate]
  )

  // Draw minimap using Canvas 2D - triggered by useEffect
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasHeight <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, canvasHeight)

    // Draw nodes as tiny dots, colored by layer
    const layerColors = [
      '#4ecdc4', // ministry
      '#45b7d1', // bureau
      '#96ceb4', // division
      '#ffeaa7', // project
      '#dfe6e9', // recipient
    ]

    for (const node of nodes) {
      const [x, y] = worldToMinimap(node.x, node.y)
      ctx.fillStyle = layerColors[node.layer] || '#ffffff'
      const size = node.layer === 0 ? 4 : node.layer === 4 ? 0.5 : 1.5
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
    }

    // Draw viewport rectangle
    ctx.strokeStyle = '#ff6b6b'
    ctx.lineWidth = 2
    ctx.strokeRect(
      viewportRect.x,
      viewportRect.y,
      viewportRect.width,
      viewportRect.height
    )
  }, [nodes, worldToMinimap, viewportRect, width, canvasHeight])

  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-0 bottom-0 bg-gray-900 border-r border-gray-700 flex flex-col z-10"
      style={{ width }}
    >
      <div className="bg-gray-800 px-2 py-1 text-xs text-gray-400 border-b border-gray-700 text-center shrink-0">
        Overview
      </div>
      <div className="flex-1 min-h-0 relative">
        <canvas
          ref={canvasRef}
          width={width}
          height={canvasHeight}
          onClick={handleClick}
          className="cursor-crosshair absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

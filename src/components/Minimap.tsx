import { useCallback, useMemo, useRef } from 'react'
import type { OrthographicViewState } from '@deck.gl/core'
import type { LayoutData } from '@/types/layout'

interface MinimapProps {
  layoutData: LayoutData
  viewState: OrthographicViewState
  onNavigate: (x: number, y: number) => void
  width?: number
  height?: number
}

export function Minimap({
  layoutData,
  viewState,
  onNavigate,
  width = 180,
  height = 300,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { bounds, nodes } = layoutData

  // Calculate scale to fit bounds in minimap
  const scale = useMemo(() => {
    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY
    const scaleX = (width - 20) / boundsWidth
    const scaleY = (height - 20) / boundsHeight
    return Math.min(scaleX, scaleY)
  }, [bounds, width, height])

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
    // Viewport size depends on zoom level
    // At zoom 0, viewport is roughly window size in world coords
    // Each zoom level doubles/halves the view
    const zoom = typeof viewState.zoom === 'number' ? viewState.zoom : 0
    const zoomFactor = Math.pow(2, zoom)
    const viewportWorldWidth = 1200 / zoomFactor // Approximate window width
    const viewportWorldHeight = 800 / zoomFactor // Approximate window height

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
      height: Math.min(height, bottom - top),
    }
  }, [viewState, worldToMinimap, width, height])

  // Handle click on minimap
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const minimapX = e.clientX - rect.left
      const minimapY = e.clientY - rect.top

      const [worldX, worldY] = minimapToWorld(minimapX, minimapY)
      onNavigate(worldX, worldY)
    },
    [minimapToWorld, onNavigate]
  )

  // Draw minimap using Canvas 2D
  const canvasCallback = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, width, height)

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
        // Size based on layer (larger for higher layers)
        const size = node.layer === 0 ? 3 : node.layer === 4 ? 0.5 : 1.5
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
    },
    [nodes, worldToMinimap, viewportRect, width, height]
  )

  // Combine refs
  const setRefs = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = canvas
      canvasCallback(canvas)
    },
    [canvasCallback]
  )

  return (
    <div
      className="absolute bottom-4 left-4 rounded-lg overflow-hidden shadow-lg border border-gray-600"
      style={{ width, height }}
    >
      <div className="bg-gray-800 px-2 py-1 text-xs text-gray-300 border-b border-gray-600">
        Overview
      </div>
      <canvas
        ref={setRefs}
        width={width}
        height={height - 24}
        onClick={handleClick}
        className="cursor-crosshair"
        style={{ display: 'block' }}
      />
    </div>
  )
}

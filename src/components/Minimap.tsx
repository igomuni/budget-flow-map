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
  const [isDragging, setIsDragging] = useState(false)
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

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement> | MouseEvent): [number, number] => {
      const canvas = canvasRef.current
      if (!canvas) return [0, 0]

      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const minimapX = (e.clientX - rect.left) * scaleX
      const minimapY = (e.clientY - rect.top) * scaleY
      return [minimapX, minimapY]
    },
    []
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

  // Navigate to position
  const navigateTo = useCallback(
    (minimapX: number, minimapY: number) => {
      const [worldX, worldY] = minimapToWorld(minimapX, minimapY)
      onNavigate(worldX, worldY)
    },
    [minimapToWorld, onNavigate]
  )

  // Handle click on minimap
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDragging) return
      const [minimapX, minimapY] = getCanvasCoords(e)
      navigateTo(minimapX, minimapY)
    },
    [getCanvasCoords, navigateTo, isDragging]
  )

  // Handle mouse down for drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [minimapX, minimapY] = getCanvasCoords(e)

      // Check if click is inside viewport rect
      if (
        minimapX >= viewportRect.x &&
        minimapX <= viewportRect.x + viewportRect.width &&
        minimapY >= viewportRect.y &&
        minimapY <= viewportRect.y + viewportRect.height
      ) {
        setIsDragging(true)
        e.preventDefault()
      }
    },
    [getCanvasCoords, viewportRect]
  )

  // Handle mouse move for drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const [minimapX, minimapY] = getCanvasCoords(e)
      navigateTo(minimapX, minimapY)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, getCanvasCoords, navigateTo])

  // Handle wheel scroll on minimap
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault()

      // Scroll amount in world coordinates
      const scrollSpeed = 500
      const target = viewState.target ?? [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2]

      // Scroll vertically
      const newY = target[1] + (e.deltaY > 0 ? scrollSpeed : -scrollSpeed)
      onNavigate(target[0], newY)
    },
    [viewState, bounds, onNavigate]
  )

  // Draw minimap using Canvas 2D
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasHeight <= 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, width, canvasHeight)

    // Draw nodes as tiny rectangles (Sankey-style), colored by layer
    const layerColors = [
      '#4ecdc4', // ministry
      '#45b7d1', // bureau
      '#96ceb4', // division
      '#ffeaa7', // project
      '#dfe6e9', // recipient
    ]

    for (const node of nodes) {
      // Get scaled node dimensions
      const nodeWidth = node.width * scale
      const nodeHeight = node.height * scale
      const [centerX, centerY] = worldToMinimap(node.x, node.y)

      ctx.fillStyle = layerColors[node.layer] || '#ffffff'
      ctx.fillRect(
        centerX - nodeWidth / 2,
        centerY - nodeHeight / 2,
        Math.max(nodeWidth, 0.5), // Minimum 0.5px width for visibility
        Math.max(nodeHeight, 0.5) // Minimum 0.5px height for visibility
      )
    }

    // Draw viewport rectangle
    ctx.strokeStyle = isDragging ? '#ffcc00' : '#ff6b6b'
    ctx.lineWidth = 2
    ctx.strokeRect(
      viewportRect.x,
      viewportRect.y,
      viewportRect.width,
      viewportRect.height
    )

    // Fill viewport with semi-transparent color
    ctx.fillStyle = isDragging ? 'rgba(255, 204, 0, 0.1)' : 'rgba(255, 107, 107, 0.1)'
    ctx.fillRect(
      viewportRect.x,
      viewportRect.y,
      viewportRect.width,
      viewportRect.height
    )
  }, [nodes, worldToMinimap, viewportRect, width, canvasHeight, isDragging])

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-0 bottom-0 bg-gray-900 border-l border-gray-700 flex flex-col z-10"
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
          onMouseDown={handleMouseDown}
          onWheel={handleWheel}
          className={`absolute inset-0 ${isDragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}

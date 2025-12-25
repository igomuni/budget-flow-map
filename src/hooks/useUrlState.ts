import { useEffect, useCallback, useRef } from 'react'

interface UrlState {
  // View state
  x?: number
  y?: number
  zoom?: number
  // Selection
  node?: string
  // TopN settings
  topProjects?: number
  topRecipients?: number
  threshold?: number
}

/**
 * Parse URL hash into state object
 */
function parseUrlHash(): UrlState {
  const hash = window.location.hash.slice(1) // Remove '#'
  if (!hash) return {}

  const params = new URLSearchParams(hash)
  const state: UrlState = {}

  const x = params.get('x')
  const y = params.get('y')
  const zoom = params.get('z')
  const node = params.get('node')
  const topProjects = params.get('tp')
  const topRecipients = params.get('tr')
  const threshold = params.get('th')

  if (x) state.x = parseFloat(x)
  if (y) state.y = parseFloat(y)
  if (zoom) state.zoom = parseFloat(zoom)
  if (node) state.node = node
  if (topProjects) state.topProjects = parseInt(topProjects, 10)
  if (topRecipients) state.topRecipients = parseInt(topRecipients, 10)
  if (threshold) state.threshold = parseFloat(threshold)

  return state
}

/**
 * Build URL hash from state object
 */
function buildUrlHash(state: UrlState): string {
  const params = new URLSearchParams()

  if (state.x !== undefined) params.set('x', state.x.toFixed(0))
  if (state.y !== undefined) params.set('y', state.y.toFixed(0))
  if (state.zoom !== undefined) params.set('z', state.zoom.toFixed(2))
  if (state.node) params.set('node', state.node)
  if (state.topProjects !== undefined) params.set('tp', state.topProjects.toString())
  if (state.topRecipients !== undefined) params.set('tr', state.topRecipients.toString())
  if (state.threshold !== undefined) params.set('th', state.threshold.toFixed(0))

  return params.toString()
}

interface UseUrlStateOptions {
  x?: number
  y?: number
  zoom?: number
  selectedNodeId?: string | null
  topProjects?: number
  topRecipients?: number
  threshold?: number
  onStateChange?: (state: UrlState) => void
}

/**
 * Hook to sync state with URL hash
 */
export function useUrlState(options: UseUrlStateOptions) {
  const {
    x,
    y,
    zoom,
    selectedNodeId,
    topProjects,
    topRecipients,
    threshold,
    onStateChange
  } = options

  const initialLoadDone = useRef(false)
  const isUpdatingUrl = useRef(false)

  // Load initial state from URL on mount
  useEffect(() => {
    if (initialLoadDone.current) return

    const urlState = parseUrlHash()
    if (Object.keys(urlState).length > 0) {
      onStateChange?.(urlState)
    }
    initialLoadDone.current = true
  }, [onStateChange])

  // Update URL when state changes (debounced)
  const updateUrl = useCallback(() => {
    if (isUpdatingUrl.current) return

    const state: UrlState = {}

    if (x !== undefined) state.x = x
    if (y !== undefined) state.y = y
    if (zoom !== undefined) state.zoom = zoom
    if (selectedNodeId) state.node = selectedNodeId
    if (topProjects !== undefined) state.topProjects = topProjects
    if (topRecipients !== undefined) state.topRecipients = topRecipients
    if (threshold !== undefined) state.threshold = threshold

    const hash = buildUrlHash(state)
    const newUrl = hash ? `#${hash}` : window.location.pathname

    // Only update if different
    if (window.location.hash !== newUrl && newUrl !== '#') {
      isUpdatingUrl.current = true
      window.history.replaceState(null, '', newUrl)
      isUpdatingUrl.current = false
    }
  }, [x, y, zoom, selectedNodeId, topProjects, topRecipients, threshold])

  // Debounce URL updates
  useEffect(() => {
    const timer = setTimeout(updateUrl, 300)
    return () => clearTimeout(timer)
  }, [updateUrl])

  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      if (isUpdatingUrl.current) return
      const urlState = parseUrlHash()
      onStateChange?.(urlState)
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [onStateChange])

  return {
    getShareUrl: useCallback(() => {
      const state: UrlState = {}
      if (x !== undefined) state.x = x
      if (y !== undefined) state.y = y
      if (zoom !== undefined) state.zoom = zoom
      if (selectedNodeId) state.node = selectedNodeId
      if (topProjects !== undefined) state.topProjects = topProjects
      if (topRecipients !== undefined) state.topRecipients = topRecipients
      if (threshold !== undefined) state.threshold = threshold

      const hash = buildUrlHash(state)
      return `${window.location.origin}${window.location.pathname}#${hash}`
    }, [x, y, zoom, selectedNodeId, topProjects, topRecipients, threshold])
  }
}

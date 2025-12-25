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

// Default values
const DEFAULTS = {
  topProjects: 500,
  topRecipients: 1000,
  threshold: 1e12,
}

/**
 * Build URL hash from state object (only non-default values)
 */
function buildUrlHash(state: UrlState): string {
  const params = new URLSearchParams()

  // Only include view state if defined
  if (state.x !== undefined && state.y !== undefined) {
    params.set('x', state.x.toFixed(0))
    params.set('y', state.y.toFixed(0))
  }
  if (state.zoom !== undefined) {
    params.set('z', state.zoom.toFixed(2))
  }
  if (state.node) {
    params.set('node', state.node)
  }
  // Only include TopN settings if different from defaults
  if (state.topProjects !== undefined && state.topProjects !== DEFAULTS.topProjects) {
    params.set('tp', state.topProjects.toString())
  }
  if (state.topRecipients !== undefined && state.topRecipients !== DEFAULTS.topRecipients) {
    params.set('tr', state.topRecipients.toString())
  }
  if (state.threshold !== undefined && state.threshold !== DEFAULTS.threshold) {
    params.set('th', state.threshold.toFixed(0))
  }

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
  const isFromUrl = useRef(false)
  const lastUrlHash = useRef('')

  // Load initial state from URL on mount
  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true

    const urlState = parseUrlHash()
    if (Object.keys(urlState).length > 0) {
      isFromUrl.current = true
      lastUrlHash.current = window.location.hash
      onStateChange?.(urlState)
      // Reset flag after a delay to allow state to settle
      setTimeout(() => {
        isFromUrl.current = false
      }, 1000)
    }
  }, [onStateChange])

  // Update URL when state changes (debounced, skip if state came from URL)
  const updateUrl = useCallback(() => {
    // Skip if we just loaded from URL
    if (isFromUrl.current) return
    // Skip if initial load not done
    if (!initialLoadDone.current) return

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

    // Only update if significantly different
    if (lastUrlHash.current !== newUrl) {
      lastUrlHash.current = newUrl
      window.history.replaceState(null, '', newUrl || window.location.pathname)
    }
  }, [x, y, zoom, selectedNodeId, topProjects, topRecipients, threshold])

  // Debounce URL updates with longer delay
  useEffect(() => {
    const timer = setTimeout(updateUrl, 500)
    return () => clearTimeout(timer)
  }, [updateUrl])

  // Listen for hash changes (back/forward navigation)
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === lastUrlHash.current) return
      isFromUrl.current = true
      lastUrlHash.current = window.location.hash
      const urlState = parseUrlHash()
      onStateChange?.(urlState)
      setTimeout(() => {
        isFromUrl.current = false
      }, 1000)
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

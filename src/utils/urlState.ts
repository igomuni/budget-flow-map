/**
 * URL state management for deep linking
 */

/**
 * Get node ID from URL (supports both path and query param formats)
 */
export function getNodeIdFromUrl(): string | null {
  // Try path format first: /node/id or /node/id/name
  const pathMatch = window.location.pathname.match(/\/node\/([^/]+)/)
  if (pathMatch) {
    return pathMatch[1]
  }

  // Fallback to query param for backward compatibility: ?node=id
  const params = new URLSearchParams(window.location.search)
  const nodeParam = params.get('node')
  if (nodeParam) {
    // Handle "id/name" format in query param
    const slashIndex = nodeParam.indexOf('/')
    return slashIndex > -1 ? nodeParam.substring(0, slashIndex) : nodeParam
  }

  return null
}

/**
 * Update URL with selected node ID and name (Google Maps style path) without page reload
 * Example: /node/<node-id>/<node-name>
 */
export function updateUrlWithNodeId(nodeId: string | null, nodeName?: string): void {
  const url = new URL(window.location.href)

  if (nodeId) {
    // Use path-based URL for readability (Google Maps style)
    const namePart = nodeName ? `/${nodeName}` : ''
    url.pathname = `/node/${nodeId}${namePart}`
    // Clear query params
    url.search = ''
  } else {
    // Return to root
    url.pathname = '/'
    url.search = ''
  }

  // Update URL without reloading the page
  window.history.replaceState({}, '', url.toString())
}

/**
 * Copy current URL to clipboard
 */
export async function copyUrlToClipboard(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    return true
  } catch (error) {
    console.error('Failed to copy URL to clipboard:', error)
    return false
  }
}

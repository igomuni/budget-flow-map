/**
 * URL state management for deep linking
 */

/**
 * Get node ID from URL query parameters
 */
export function getNodeIdFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('node')
}

/**
 * Update URL with selected node ID and name (Google Maps style) without page reload
 * Example: ?node=<node-id>/<url-encoded-node-name>
 */
export function updateUrlWithNodeId(nodeId: string | null, nodeName?: string): void {
  const url = new URL(window.location.href)

  if (nodeId) {
    // Include node name for readability (Google Maps style)
    const nodeParam = nodeName ? `${nodeId}/${encodeURIComponent(nodeName)}` : nodeId
    url.searchParams.set('node', nodeParam)
  } else {
    url.searchParams.delete('node')
  }

  // Update URL without reloading the page
  window.history.replaceState({}, '', url.toString())
}

/**
 * Parse node ID from URL parameter (handles both "id" and "id/name" formats)
 */
export function parseNodeIdFromParam(param: string): string {
  // If param contains '/', extract only the ID part
  const slashIndex = param.indexOf('/')
  return slashIndex > -1 ? param.substring(0, slashIndex) : param
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

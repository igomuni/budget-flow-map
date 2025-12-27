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
 * Update URL with selected node ID without page reload
 */
export function updateUrlWithNodeId(nodeId: string | null): void {
  const url = new URL(window.location.href)

  if (nodeId) {
    url.searchParams.set('node', nodeId)
  } else {
    url.searchParams.delete('node')
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

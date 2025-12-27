/**
 * Capture the current deck.gl canvas as a screenshot
 */
export function captureScreenshot(filename: string = '予算フローマップ'): void {
  // Find the deck.gl canvas element
  const canvas = document.querySelector('canvas') as HTMLCanvasElement

  if (!canvas) {
    console.error('Canvas element not found')
    return
  }

  try {
    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Failed to create blob from canvas')
        return
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.png`

      // Trigger download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up
      URL.revokeObjectURL(url)
    }, 'image/png')
  } catch (error) {
    console.error('Failed to capture screenshot:', error)
  }
}

/**
 * Capture screenshot with current timestamp
 */
export function captureScreenshotWithTimestamp(): void {
  const now = new Date()
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  captureScreenshot(`予算フローマップ_${timestamp}`)
}

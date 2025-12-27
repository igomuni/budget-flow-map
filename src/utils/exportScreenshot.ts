/**
 * Capture the current deck.gl canvas as a screenshot
 */
export function captureScreenshot(filename: string = '予算フローマップ'): void {
  // Find the deck.gl canvas element
  const sourceCanvas = document.querySelector('canvas') as HTMLCanvasElement

  if (!sourceCanvas) {
    console.error('Canvas element not found')
    return
  }

  try {
    // Create a new canvas with background color
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = sourceCanvas.width
    outputCanvas.height = sourceCanvas.height

    const ctx = outputCanvas.getContext('2d')
    if (!ctx) {
      console.error('Failed to get 2D context')
      return
    }

    // Fill background with dark blue (matching DeckGL background)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height)

    // Draw the source canvas on top
    ctx.drawImage(sourceCanvas, 0, 0)

    // Convert canvas to blob
    outputCanvas.toBlob((blob) => {
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

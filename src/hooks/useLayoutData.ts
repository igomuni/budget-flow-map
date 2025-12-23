import { useState, useEffect } from 'react'
import type { LayoutData } from '@/types/layout'

interface UseLayoutDataResult {
  data: LayoutData | null
  loading: boolean
  error: Error | null
}

/**
 * Hook to load layout data from JSON file
 */
export function useLayoutData(): UseLayoutDataResult {
  const [data, setData] = useState<LayoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/data/layout.json')

        if (!response.ok) {
          throw new Error(`Failed to load layout data: ${response.status}`)
        }

        const json = await response.json()

        if (!cancelled) {
          setData(json as LayoutData)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}

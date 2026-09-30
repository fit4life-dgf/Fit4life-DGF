import { useCallback, useEffect, useState } from 'react'
import { fetchToday } from '../services/health'
import type { TodayData } from '../types'

export function useToday(userId: string | undefined) {
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) return
    try {
      setError(null)
      setData(await fetchToday(userId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your data.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}

import { useCallback, useEffect, useRef, useState } from 'react'

/** Runs an async loader on mount and whenever `deps` change. Ignores results from stale runs. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const run = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const load = useCallback(async () => {
    const id = ++run.current
    try {
      setError(null)
      const v = await fnRef.current()
      if (id === run.current) setData(v)
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      if (id === run.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload: load, setData }
}

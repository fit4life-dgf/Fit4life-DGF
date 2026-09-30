import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DetailId, DetailState, Nav, TabId } from '../types'

const Ctx = createContext<Nav | null>(null)

export function NavProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>('today')
  const [detail, setDetail] = useState<DetailState | null>(null)
  const go = useCallback((t: TabId) => { setDetail(null); setTab(t); window.scrollTo(0, 0) }, [])
  const open = useCallback((id: DetailId, param?: string) => { setDetail({ id, param }); window.scrollTo(0, 0) }, [])
  const back = useCallback(() => setDetail(null), [])
  const value = useMemo<Nav>(() => ({ tab, go, detail, open, back }), [tab, go, detail, open, back])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNav(): Nav {
  const v = useContext(Ctx)
  if (!v) throw new Error('useNav must be used inside NavProvider')
  return v
}

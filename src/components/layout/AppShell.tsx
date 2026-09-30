import type { ReactNode } from 'react'
import type { TabId } from '../../types'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'

interface Props { tab: TabId; onChange: (t: TabId) => void; children: ReactNode }

export function AppShell({ tab, onChange, children }: Props) {
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <Sidebar tab={tab} onChange={onChange} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 lg:px-8 lg:pb-10" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
        {children}
      </main>
      <BottomNav tab={tab} onChange={onChange} />
    </div>
  )
}

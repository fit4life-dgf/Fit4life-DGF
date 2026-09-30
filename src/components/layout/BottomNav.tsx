import { Dumbbell, Home, Sparkles, TrendingUp, User } from 'lucide-react'
import type { ComponentType } from 'react'
import type { TabId } from '../../types'

export const TABS: { id: TabId; label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: 'today', label: 'Today', Icon: Home },
  { id: 'fitness', label: 'Fitness', Icon: Dumbbell },
  { id: 'coach', label: 'AI Coach', Icon: Sparkles },
  { id: 'progress', label: 'Progress', Icon: TrendingUp },
  { id: 'profile', label: 'Profile', Icon: User },
]

interface Props { tab: TabId; onChange: (t: TabId) => void }

export function BottomNav({ tab, onChange }: Props) {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <ul className="mx-auto flex max-w-lg justify-around px-2 py-2">
        {TABS.map(({ id, label, Icon }) => {
          const on = id === tab
          return (
            <li key={id}>
              <button aria-current={on ? 'page' : undefined} onClick={() => onChange(id)} className="flex min-w-[64px] flex-col items-center gap-1 px-2 py-1">
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${on ? 'bg-accent/15 text-accent' : 'text-muted'}`}><Icon size={22} strokeWidth={on ? 2.4 : 2} /></span>
                <span className={`text-[11px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

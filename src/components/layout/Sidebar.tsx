import type { TabId } from '../../types'
import { TABS } from './BottomNav'

interface Props { tab: TabId; onChange: (t: TabId) => void }

export function Sidebar({ tab, onChange }: Props) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-card p-4 lg:block">
      <div className="mb-6 px-3 text-xl font-extrabold tracking-tight">FIT<span className="text-accent">4</span>LIFE</div>
      <nav aria-label="Main">
        <ul className="grid gap-1">
          {TABS.map(({ id, label, Icon }) => {
            const on = id === tab
            return (
              <li key={id}>
                <button aria-current={on ? 'page' : undefined} onClick={() => onChange(id)} className={`flex min-h-[44px] w-full items-center gap-3 rounded-tile px-3 text-sm font-semibold ${on ? 'bg-accent/15 text-accent' : 'text-ink2 hover:bg-card2'}`}>
                  <Icon size={20} />{label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

import type { ReactNode } from 'react'

interface Props { icon: ReactNode; title: string; text: string; action?: ReactNode }
export function EmptyState({ icon, title, text, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-card p-8 text-center animate-rise">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card2 text-ink2">{icon}</div>
      <h2 className="text-base font-bold">{title}</h2>
      <p className="max-w-xs text-sm text-ink2">{text}</p>
      {action}
    </div>
  )
}

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

export function PageHeader({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center gap-2">
      {onBack && (
        <button aria-label="Back" onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-card2 text-ink"><ChevronLeft size={20} /></button>
      )}
      <h1 className="flex-1 text-2xl font-extrabold">{title}</h1>
      {right}
    </header>
  )
}

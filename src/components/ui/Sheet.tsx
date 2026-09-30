import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode }

/** Bottom sheet on phones, centred dialog on larger screens. Esc and backdrop tap close it. */
export function Sheet({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="relative w-full max-w-md animate-sheet rounded-t-[24px] bg-card p-5 pb-8 shadow-xl outline-none sm:rounded-[24px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-card2 text-ink2"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

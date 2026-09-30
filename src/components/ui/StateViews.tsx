import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { Skeleton } from './Skeleton'

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-line bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-bad"><AlertTriangle size={18} />Something went wrong</p>
      <p className="text-sm text-ink2">{message}</p>
      {onRetry && <Button variant="soft" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function LoadingBlocks({ n = 2, h = 'h-32' }: { n?: number; h?: string }) {
  return <div className="grid gap-3" aria-busy="true" aria-label="Loading">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className={h} />)}</div>
}

export function Notice({ text, tone = 'info' }: { text: string; tone?: 'info' | 'good' | 'bad' }) {
  const c = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : 'text-ink2'
  return <p role={tone === 'bad' ? 'alert' : 'status'} className={`rounded-tile bg-card2 p-3 text-sm ${c}`}>{text}</p>
}

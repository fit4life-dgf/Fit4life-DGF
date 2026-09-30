export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`relative overflow-hidden rounded-card bg-card2 ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
    </div>
  )
}

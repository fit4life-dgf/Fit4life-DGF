import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'soft' | 'ghost'
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  busy?: boolean
}
const V: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:opacity-90',
  soft: 'bg-card2 text-ink hover:bg-line',
  ghost: 'bg-transparent text-ink2 hover:bg-card2',
}

export function Button({ variant = 'primary', busy, disabled, className = '', children, ...rest }: Props) {
  return (
    <button
      disabled={disabled || busy}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-tile px-4 text-sm font-semibold transition disabled:opacity-50 ${V[variant]} ${className}`}
      {...rest}
    >
      {busy ? 'Please wait…' : children}
    </button>
  )
}

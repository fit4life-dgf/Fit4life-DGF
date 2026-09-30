interface Props<T extends string> { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }

export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 rounded-full bg-card2 p-1">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={o.id === value} onClick={() => onChange(o.id)}
          className={`min-h-[40px] flex-1 rounded-full px-3 text-sm font-semibold transition ${o.id === value ? 'bg-card text-ink shadow-card' : 'text-ink2'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface Props { options: number[]; onPick: (n: number) => void; suffix?: string; format?: (n: number) => string }
export function Chips({ options, onPick, suffix = '', format }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((n) => (
        <button key={n} onClick={() => onPick(n)} className="min-h-[44px] rounded-full border border-line bg-card2 px-4 text-sm font-semibold active:bg-accent active:text-white">
          {format ? format(n) : n.toLocaleString('en-IN')}{suffix}
        </button>
      ))}
    </div>
  )
}

export function formatDuration(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = Math.round(totalMin % 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('en-IN')
}

export function litres(ml: number): string {
  return (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, '')
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

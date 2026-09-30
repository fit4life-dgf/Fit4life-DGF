import { useEffect, useState } from 'react'

/** Resolves a design-token CSS variable (e.g. "accent") to an rgb() string; updates when the theme changes. Needed because chart libraries set colours as SVG attributes. */
export function useCssColors(names: string[]): string[] {
  const read = () => names.map((n) => {
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim()
    return v ? `rgb(${v.split(/\s+/).join(',')})` : '#888'
  })
  const [colors, setColors] = useState<string[]>(read)
  useEffect(() => {
    const obs = new MutationObserver(() => setColors(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names.join(',')])
  return colors
}

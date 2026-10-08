import { measure } from '../lib/text.ts'
import { Label, Marker } from './primitives.tsx'
import { OPACITY, type Shape, white } from './theme.ts'

export interface LegendItem {
  label: string
  shape?: Shape
  dash?: string
  filled?: boolean
  opacity?: number
}

export function legendWidth(items: LegendItem[], s: number): number {
  const size = 16 * s
  return items.reduce(
    (w, it) =>
      w + (it.dash !== undefined ? 34 * s : 22 * s) + measure(it.label, size, 500) + 22 * s,
    0,
  )
}

// right-aligned on (x, y)
export function Legend({
  items,
  x,
  y,
  s,
}: {
  items: LegendItem[]
  x: number
  y: number
  s: number
}) {
  const size = 16 * s
  let cx = x - legendWidth(items, s)
  return (
    <g>
      {items.map((it) => {
        const lineW = it.dash !== undefined ? 34 * s : 22 * s
        const x0 = cx
        cx += lineW + measure(it.label, size, 500) + 22 * s
        return (
          <g key={it.label}>
            {it.dash !== undefined ? (
              <line
                x1={x0}
                x2={x0 + lineW - 8 * s}
                y1={y}
                y2={y}
                stroke={white()}
                strokeWidth={3 * s}
                strokeDasharray={scaleDash(it.dash, s)}
                strokeLinecap={it.dash ? 'butt' : 'round'}
              />
            ) : (
              <Marker
                shape={it.shape ?? 'circle'}
                x={x0 + 7 * s}
                y={y}
                r={6.5 * s}
                filled={it.filled ?? true}
                opacity={it.opacity ?? 1}
              />
            )}
            <Label x={x0 + lineW} y={y} size={size} opacity={OPACITY.secondary}>
              {it.label}
            </Label>
          </g>
        )
      })}
    </g>
  )
}

export function scaleDash(dash: string, s: number): string | undefined {
  if (!dash) return undefined
  return dash
    .split(' ')
    .map((n) => Number(n) * s)
    .join(' ')
}

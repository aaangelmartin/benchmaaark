import { extent } from 'd3-array'
import { scaleLinear, scaleLog, type ScaleLinear, type ScaleLogarithmic } from 'd3-scale'
import { formatValue } from '../lib/format.ts'
import type { MetricDef, MetricUnit } from '../lib/types.ts'
import { Label } from './primitives.tsx'
import type { Resolved } from './spec.ts'
import { type Box, OPACITY, white } from './theme.ts'

export interface ChartProps {
  r: Resolved
  box: Box
  s: number // type scale, see theme.unit()
  tx: (t: string) => string // applies the lowercase rule
}

export type NumScale = ScaleLinear<number, number> | ScaleLogarithmic<number, number>

export function valueScale(
  values: number[],
  range: [number, number],
  log: boolean,
  pad = 0.06,
  unit?: MetricUnit,
): NumScale {
  const [lo, hi] = extent(values.filter((v) => !log || v > 0)) as [number, number]
  if (lo === undefined) return scaleLinear().domain([0, 1]).range(range)
  if (log) {
    const k = Math.pow(hi / lo, pad) || 1.5
    return scaleLog()
      .domain([lo / k, hi * k])
      .range(range)
  }
  const span = hi - lo || Math.abs(hi) || 1
  const scale = scaleLinear()
    .domain([lo - span * pad, hi + span * pad])
    .range(range)
    .nice(6)
  // padding must not invent impossible values: no negative scores or prices,
  // no shares above 100%
  const [d0, d1] = scale.domain()
  const floor = lo >= 0 ? 0 : -Infinity
  const ceil = hi <= 1 && lo >= 0 && unit === 'fraction' ? 1 : Infinity
  return scale.domain([Math.max(d0, floor), Math.min(d1, ceil)])
}

// minutes read best on clock steps: 1 min, 15 min, 1 h, 8 h, 1 d...
const MINUTE_STEPS = [
  0.25, 0.5, 1, 2, 4, 8, 15, 30, 60, 120, 240, 480, 960, 1440, 2880, 5760, 10080, 20160, 43200,
]

// log ticks on 1-2-5 steps, thinned until they fit
export function ticksFor(scale: NumScale, log: boolean, max = 7, unit?: MetricUnit): number[] {
  if (unit === 'minutes' && log) {
    const [a, b] = scale.domain()
    let out = MINUTE_STEPS.filter((v) => v >= a && v <= b)
    while (out.length > max) out = out.filter((_, i) => i % 2 === 0)
    return out
  }
  if (!log) return (scale as ScaleLinear<number, number>).ticks(max)
  const [a, b] = scale.domain()
  for (const steps of [[1, 2, 5], [1, 3], [1]]) {
    const out: number[] = []
    for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) {
      for (const st of steps) {
        const v = st * Math.pow(10, e)
        if (v >= a && v <= b) out.push(v)
      }
    }
    if (out.length <= max) return out
  }
  return scale.ticks(max)
}

export function GridY({
  scale,
  ticks,
  box,
  s,
  metric,
}: {
  scale: NumScale
  ticks: number[]
  box: Box
  s: number
  metric: MetricDef
}) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={box.x}
            x2={box.x + box.w}
            y1={scale(t)}
            y2={scale(t)}
            stroke={white(OPACITY.surface)}
            strokeWidth={1.5 * s}
          />
          <Label x={box.x - 14 * s} y={scale(t)} size={16 * s} opacity={OPACITY.muted} anchor="end">
            {formatValue(t, metric.unit, true)}
          </Label>
        </g>
      ))}
    </g>
  )
}

export function GridX({
  scale,
  ticks,
  box,
  s,
  format,
}: {
  scale: (v: number) => number
  ticks: number[]
  box: Box
  s: number
  format: (v: number) => string
}) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={scale(t)}
            x2={scale(t)}
            y1={box.y}
            y2={box.y + box.h}
            stroke={white(OPACITY.surface * 0.7)}
            strokeWidth={1.5 * s}
          />
          <Label
            x={scale(t)}
            y={box.y + box.h + 26 * s}
            size={16 * s}
            opacity={OPACITY.muted}
            anchor="middle"
          >
            {format(t)}
          </Label>
        </g>
      ))}
    </g>
  )
}

export function Empty({ box, s, text }: { box: Box; s: number; text: string }) {
  return (
    <Label
      x={box.x + box.w / 2}
      y={box.y + box.h / 2}
      size={24 * s}
      opacity={OPACITY.muted}
      anchor="middle"
    >
      {text}
    </Label>
  )
}

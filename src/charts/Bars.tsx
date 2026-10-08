import { formatValue } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { ellipsize, measure } from '../lib/text.ts'
import type { MetricDef, Model } from '../lib/types.ts'
import { type ChartProps, Empty } from './axes.tsx'
import { Legend } from './Legend.tsx'
import { Label } from './primitives.tsx'
import { OPACITY, white } from './theme.ts'

// indices and elo cluster high above zero, so their bars start from a visible
// baseline (printed under the chart). shares, prices and sizes start at zero.
export function barBaseline(def: MetricDef, values: number[]): number {
  if (def.unit !== 'elo' && def.unit !== 'index') return 0
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const step = def.unit === 'elo' ? 50 : 10
  return Math.max(0, Math.floor((lo - (hi - lo) * 0.35) / step) * step)
}

export function sortModels(models: Model[], def: MetricDef, sort: 'best' | 'worst'): Model[] {
  const dir = (def.higherIsBetter ? -1 : 1) * (sort === 'best' ? 1 : -1)
  return [...models].sort((a, b) => dir * (a.values[def.id] - b.values[def.id]))
}

export function Bars({ r, box: outer, s, tx }: ChartProps) {
  const { spec } = r
  const Y = r.metric(spec.y)
  if (!Y || r.models.length === 0)
    return <Empty box={outer} s={s} text={tx(t('noData', spec.locale))} />
  const L = spec.locale
  // only a lab legend: models are always named on their own row
  const legendH = spec.options.color === 'lab' && r.toneLegend.length ? 40 * s : 0
  const box = { ...outer, y: outer.y + legendH, h: outer.h - legendH }
  const models = sortModels(r.models, Y, spec.options.sort)
  const values = models.map((m) => m.values[Y.id])
  const base = barBaseline(Y, values)
  const max = Math.max(...values)
  const anyHl = models.some(r.isHighlighted)
  const best = sortModels(models, Y, 'best')[0]

  const footH = base > 0 ? 30 * s : 0
  const rowH = (box.h - footH) / models.length
  const nameSize = Math.min(22 * s, rowH * 0.42)
  const labSize = nameSize * 0.72
  const showLab = spec.options.showLab && rowH > nameSize * 2.1
  const thick = Math.min(rowH * (showLab ? 0.5 : 0.62), 34 * s)

  const rankW = measure(String(models.length).padStart(2, '0'), nameSize, 600) + 16 * s
  const nameW = Math.min(
    box.w * 0.34,
    Math.max(...models.map((m) => measure(tx(m.name), nameSize, 600))) + 24 * s,
  )
  const valW =
    Math.max(...values.map((v) => measure(formatValue(v, Y.unit), nameSize, 700))) + 18 * s
  const x0 = box.x + rankW + nameW
  const trackW = box.w - rankW - nameW - valW
  const bx = (v: number) => x0 + Math.max(thick, ((v - base) / (max - base || 1)) * trackW)

  return (
    <g>
      {legendH > 0 && (
        <Legend
          items={r.toneLegend.map((it) => ({
            label: tx(it.label),
            shape: 'square',
            opacity: it.opacity,
          }))}
          x={outer.x + outer.w}
          y={outer.y + 10 * s}
          s={s}
        />
      )}
      {models.map((m, i) => {
        const v = m.values[Y.id]
        const cy = box.y + rowH * i + rowH / 2
        const hl = anyHl ? r.isHighlighted(m) : m.id === best.id
        const op =
          spec.options.color !== 'none'
            ? r.tone(m) * (anyHl && !hl ? 0.45 : 1)
            : anyHl
              ? hl
                ? 1
                : 0.45
              : hl
                ? 1
                : 0.82
        const nameY = showLab ? cy - labSize * 0.55 : cy
        return (
          <g key={m.id} data-id={m.id}>
            <rect x={box.x} y={cy - rowH / 2} width={box.w} height={rowH} fill="transparent" />
            <Label x={box.x} y={nameY} size={nameSize} weight={600} opacity={OPACITY.muted}>
              {String(i + 1).padStart(2, '0')}
            </Label>
            <Label
              x={box.x + rankW}
              y={nameY}
              size={nameSize}
              weight={hl ? 700 : 600}
              opacity={op === 1 ? 1 : 0.9}
            >
              {ellipsize(tx(m.name), nameW - 20 * s, nameSize, 600)}
            </Label>
            {showLab && (
              <Label
                x={box.x + rankW}
                y={cy + nameSize * 0.6}
                size={labSize}
                opacity={OPACITY.muted}
              >
                {tx(r.lab(m.lab))}
              </Label>
            )}
            <rect
              x={x0}
              y={cy - thick / 2}
              width={trackW}
              height={thick}
              rx={thick / 2}
              fill={white(OPACITY.surface)}
            />
            <rect
              x={x0}
              y={cy - thick / 2}
              width={bx(v) - x0}
              height={thick}
              rx={thick / 2}
              fill={white(op)}
            />
            <Label x={bx(v) + 12 * s} y={cy} size={nameSize} weight={700} opacity={hl ? 1 : 0.85}>
              {formatValue(v, Y.unit)}
            </Label>
          </g>
        )
      })}
      {base > 0 && (
        <Label x={x0} y={box.y + box.h - 8 * s} size={14 * s} opacity={OPACITY.muted}>
          {tx(
            L === 'es'
              ? `las barras empiezan en ${formatValue(base, Y.unit)}`
              : `bars start at ${formatValue(base, Y.unit)}`,
          )}
        </Label>
      )}
    </g>
  )
}

import { formatValue } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { ellipsize, measure } from '../lib/text.ts'
import type { MetricDef } from '../lib/types.ts'
import { type ChartProps, Empty } from './axes.tsx'
import { barBaseline, sortModels } from './Bars.tsx'
import { Label } from './primitives.tsx'
import { OPACITY, white } from './theme.ts'

function gridFor(n: number, aspect: number): number {
  if (aspect > 1.4) return n <= 3 ? n : Math.ceil(n / 2)
  if (aspect > 0.75) return n === 1 ? 1 : n <= 4 ? 2 : Math.min(3, Math.ceil(n / 2))
  return n > 4 ? 2 : 1
}

// small multiples: one panel per metric, the same models in every panel
export function Compare({ r, box, s, tx }: ChartProps) {
  const { spec } = r
  const L = spec.locale
  const metrics = spec.metrics.map((id) => r.metric(id)).filter((m): m is MetricDef => !!m)
  if (!metrics.length || !r.models.length)
    return <Empty box={box} s={s} text={tx(t('noData', L))} />

  const cols = gridFor(metrics.length, box.w / box.h)
  const rows = Math.ceil(metrics.length / cols)
  const gapX = 48 * s
  const gapY = 40 * s
  const pw = (box.w - gapX * (cols - 1)) / cols
  const ph = (box.h - gapY * (rows - 1)) / rows

  const headSize = Math.min(20 * s, ph * 0.14)
  const rowH = (ph - headSize * 2.2) / r.models.length
  const nameSize = Math.min(17 * s, rowH * 0.5)
  const nameW = Math.min(
    pw * 0.42,
    Math.max(...r.models.map((m) => measure(tx(m.name), nameSize, 500))) + 14 * s,
  )
  const thick = Math.min(rowH * 0.5, 22 * s)
  const anyHl = r.models.some(r.isHighlighted)

  return (
    <g>
      {metrics.map((def, i) => {
        const px = box.x + (i % cols) * (pw + gapX)
        const py = box.y + Math.floor(i / cols) * (ph + gapY)
        const vals = r.models.map((m) => m.values[def.id]).filter((v) => v !== undefined)
        const best = sortModels(
          r.models.filter((m) => m.values[def.id] !== undefined),
          def,
          'best',
        )[0]
        const base = vals.length ? barBaseline(def, vals) : 0
        const max = vals.length ? Math.max(...vals) : 1
        const valW =
          Math.max(
            ...(vals.length ? vals : [0]).map((v) =>
              measure(formatValue(v, def.unit), nameSize, 700),
            ),
          ) +
          12 * s
        const x0 = px + nameW
        const trackW = pw - nameW - valW
        return (
          <g key={def.id}>
            <Label x={px} y={py + headSize * 0.6} size={headSize} weight={700}>
              {tx(def.short[L])}
            </Label>
            <Label
              x={px + pw}
              y={py + headSize * 0.6}
              size={headSize * 0.7}
              opacity={OPACITY.muted}
              anchor="end"
            >
              {tx(
                def.higherIsBetter
                  ? L === 'es'
                    ? 'más es mejor'
                    : 'higher is better'
                  : L === 'es'
                    ? 'menos es mejor'
                    : 'lower is better',
              )}
            </Label>
            <line
              x1={px}
              x2={px + pw}
              y1={py + headSize * 1.5}
              y2={py + headSize * 1.5}
              stroke={white(OPACITY.border)}
              strokeWidth={1.5 * s}
            />
            {r.models.map((m, j) => {
              const v = m.values[def.id]
              const cy = py + headSize * 2.2 + rowH * j + rowH / 2
              const top = best?.id === m.id
              const hl = anyHl ? r.isHighlighted(m) : top
              const w =
                v === undefined ? 0 : Math.max(thick, ((v - base) / (max - base || 1)) * trackW)
              return (
                <g key={m.id} data-id={m.id}>
                  <rect x={px} y={cy - rowH / 2} width={pw} height={rowH} fill="transparent" />
                  <Label
                    x={px}
                    y={cy}
                    size={nameSize}
                    opacity={hl ? 1 : OPACITY.secondary}
                    weight={hl ? 600 : 500}
                  >
                    {ellipsize(tx(m.name), nameW - 12 * s, nameSize, 500)}
                  </Label>
                  <rect
                    x={x0}
                    y={cy - thick / 2}
                    width={trackW}
                    height={thick}
                    rx={thick / 2}
                    fill={white(OPACITY.surface)}
                  />
                  {v !== undefined && (
                    <rect
                      x={x0}
                      y={cy - thick / 2}
                      width={w}
                      height={thick}
                      rx={thick / 2}
                      fill={white(hl ? 1 : 0.5)}
                    />
                  )}
                  <Label
                    x={v === undefined ? x0 + 10 * s : x0 + w + 10 * s}
                    y={cy}
                    size={nameSize}
                    weight={top ? 700 : 500}
                    opacity={v === undefined ? OPACITY.muted : 1}
                  >
                    {v === undefined ? '-' : formatValue(v, def.unit)}
                  </Label>
                </g>
              )
            })}
          </g>
        )
      })}
    </g>
  )
}

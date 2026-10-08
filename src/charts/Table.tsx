import { formatValue } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { ellipsize, measure } from '../lib/text.ts'
import type { MetricDef } from '../lib/types.ts'
import { type ChartProps, Empty } from './axes.tsx'
import { sortModels } from './Bars.tsx'
import { Label } from './primitives.tsx'
import { OPACITY, white } from './theme.ts'

export function Table({ r, box, s, tx }: ChartProps) {
  const { spec } = r
  const L = spec.locale
  const cols = spec.metrics.map((id) => r.metric(id)).filter((m): m is MetricDef => !!m)
  if (!cols.length || !r.models.length) return <Empty box={box} s={s} text={tx(t('noData', L))} />

  const headH = 40 * s
  const rowH = (box.h - headH) / r.models.length
  const size = Math.min(22 * s, rowH * 0.4)
  const labSize = size * 0.7
  const showLab = spec.options.showLab && rowH > size * 2.2
  const headSize = Math.min(15 * s, size * 0.8)

  const rankW = measure('00', size, 600) + 20 * s
  const colW = Math.max(
    ...cols.map((c) => measure(tx(c.short[L]), headSize, 600, 0.04) + 24 * s),
    ...cols.flatMap((c) =>
      r.models.map((m) =>
        m.values[c.id] === undefined
          ? 0
          : measure(formatValue(m.values[c.id], c.unit), size, 700) + 40 * s,
      ),
    ),
  )
  const metricsW = Math.min(colW * cols.length, box.w * 0.66)
  const cw = metricsW / cols.length
  const nameW = box.w - rankW - metricsW
  const best = new Map(
    cols.map((c) => [
      c.id,
      sortModels(
        r.models.filter((m) => m.values[c.id] !== undefined),
        c,
        'best',
      )[0]?.id,
    ]),
  )

  return (
    <g>
      <Label
        x={box.x}
        y={box.y + headH / 2}
        size={headSize}
        weight={600}
        opacity={OPACITY.muted}
        tracking={0.06}
      >
        #
      </Label>
      <Label
        x={box.x + rankW}
        y={box.y + headH / 2}
        size={headSize}
        weight={600}
        opacity={OPACITY.muted}
        tracking={0.06}
      >
        {tx(t('model', L))}
      </Label>
      {cols.map((c, j) => (
        <Label
          key={c.id}
          x={box.x + rankW + nameW + cw * (j + 1) - 12 * s}
          y={box.y + headH / 2}
          size={headSize}
          weight={600}
          opacity={OPACITY.muted}
          anchor="end"
          tracking={0.04}
        >
          {tx(c.short[L])}
        </Label>
      ))}
      <line
        x1={box.x}
        x2={box.x + box.w}
        y1={box.y + headH}
        y2={box.y + headH}
        stroke={white(OPACITY.muted)}
        strokeWidth={1.5 * s}
      />

      {r.models.map((m, i) => {
        const y = box.y + headH + rowH * i
        const cy = y + rowH / 2
        const hl = r.isHighlighted(m)
        const nameY = showLab ? cy - labSize * 0.55 : cy
        return (
          <g key={m.id} data-id={m.id}>
            <rect x={box.x} y={y} width={box.w} height={rowH} fill="transparent" />
            {i > 0 && (
              <line
                x1={box.x}
                x2={box.x + box.w}
                y1={y}
                y2={y}
                stroke={white(OPACITY.border)}
                strokeWidth={1.2 * s}
              />
            )}
            <Label x={box.x} y={nameY} size={size} weight={600} opacity={OPACITY.muted}>
              {String(i + 1).padStart(2, '0')}
            </Label>
            <Label x={box.x + rankW} y={nameY} size={size} weight={hl ? 700 : 600}>
              {ellipsize(tx(m.name), nameW - 16 * s, size, 600)}
            </Label>
            {showLab && (
              <Label x={box.x + rankW} y={cy + size * 0.62} size={labSize} opacity={OPACITY.muted}>
                {tx(r.lab(m.lab))}
              </Label>
            )}
            {cols.map((c, j) => {
              const v = m.values[c.id]
              const top = best.get(c.id) === m.id
              const right = box.x + rankW + nameW + cw * (j + 1) - 12 * s
              const text = v === undefined ? '-' : formatValue(v, c.unit)
              const tw = measure(text, size, 700)
              return (
                <g key={c.id}>
                  {top && (
                    <rect
                      x={right - tw - 14 * s}
                      y={cy - size * 0.82}
                      width={tw + 28 * s}
                      height={size * 1.64}
                      rx={size * 0.82}
                      fill={white(OPACITY.surface * 1.6)}
                    />
                  )}
                  <Label
                    x={right}
                    y={cy}
                    size={size}
                    weight={top ? 700 : 500}
                    opacity={v === undefined ? OPACITY.faint : top ? 1 : OPACITY.secondary}
                    anchor="end"
                  >
                    {text}
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

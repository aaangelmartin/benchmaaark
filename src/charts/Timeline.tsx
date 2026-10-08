import { scaleUtc } from 'd3-scale'
import { curveStepAfter, line } from 'd3-shape'
import { axisTitle, formatValue, monthTick } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { measure } from '../lib/text.ts'
import type { Model } from '../lib/types.ts'
import { type ChartProps, Empty, GridX, GridY, ticksFor, valueScale } from './axes.tsx'
import { lineObstacles, placeLabels, spreadVertically } from './labels.ts'
import { scaleDash } from './Legend.tsx'
import { Label, Marker } from './primitives.tsx'
import { DASHES, OPACITY, type Shape, white, ink } from './theme.ts'

const date = (m: Model) => new Date(`${m.releaseDate}T00:00:00Z`).getTime()

// models that beat every earlier model, in release order
export function records(models: Model[], metric: string, high: boolean): Model[] {
  const out: Model[] = []
  let best = -Infinity
  for (const m of [...models].sort((a, b) => date(a) - date(b))) {
    const v = high ? m.values[metric] : -m.values[metric]
    if (v > best) {
      out.push(m)
      best = v
    }
  }
  return out
}

interface Group {
  key: string
  label: string
  models: Model[]
  shape: Shape
  dash: string
}

export function Timeline({ r, box, s, tx }: ChartProps) {
  const { spec } = r
  const Y = r.metric(spec.y)
  if (!Y || r.models.length === 0)
    return <Empty box={box} s={s} text={tx(t('noData', spec.locale))} />
  const L = spec.locale
  const logY = spec.options.logY
  const mode = spec.options.series

  // ---- groups ----
  let groups: Group[] = []
  if (mode === 'lab') {
    const best = new Map<string, number>()
    for (const m of r.models) {
      const v = Y.higherIsBetter ? m.values[Y.id] : -m.values[Y.id]
      best.set(m.lab, Math.max(best.get(m.lab) ?? -Infinity, v))
    }
    const labs = spec.filter.labs.length
      ? spec.filter.labs.filter((l) => best.has(l))
      : [...best.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([l]) => l)
    groups = labs.slice(0, 6).map((lab, i) => ({
      key: lab,
      label: r.lab(lab),
      models: r.models.filter((m) => m.lab === lab),
      shape: r.shapeOf(lab),
      dash: DASHES[i],
    }))
  } else if (mode === 'weights') {
    groups = [
      {
        key: 'closed',
        label: t('closedWeights', L),
        models: r.models.filter((m) => m.openWeights === false),
        shape: 'circle',
        dash: '',
      },
      {
        key: 'open',
        label: t('openWeights', L),
        models: r.models.filter((m) => m.openWeights === true),
        shape: 'ring',
        dash: DASHES[1],
      },
    ].filter((g) => g.models.length) as Group[]
  } else {
    groups = [{ key: 'all', label: t('frontier', L), models: r.models, shape: 'circle', dash: '' }]
  }
  const grouped = new Set(groups.flatMap((g) => g.models.map((m) => m.id)))
  const loose = r.models.filter((m) => !grouped.has(m.id))
  const recs = groups.map((g) =>
    spec.options.frontier ? records(g.models, Y.id, Y.higherIsBetter) : [],
  )
  const isRecord = new Set(recs.flat().map((m) => m.id))

  // ---- layout ----
  const endSize = 17 * s
  const endW =
    mode === 'none'
      ? 0
      : Math.max(...groups.map((g) => measure(tx(g.label), endSize, 600))) + 26 * s
  const probe = valueScale(
    r.models.map((m) => m.values[Y.id]),
    [0, 1],
    logY,
  )
  const tickW = Math.max(
    ...ticksFor(probe, logY, 6, Y.unit).map((v) => measure(formatValue(v, Y.unit, true), 16 * s)),
  )
  const plot = {
    x: box.x + tickW + 18 * s,
    y: box.y + 44 * s,
    w: box.w - tickW - 18 * s - endW - 8 * s,
    h: box.h - 44 * s - 48 * s,
  }
  const times = r.models.map(date)
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const padT = (t1 - t0) * 0.03 || 86400000 * 30
  const xs = scaleUtc()
    .domain([t0 - padT, t1 + padT])
    .range([plot.x, plot.x + plot.w])
  const ys = valueScale(
    r.models.map((m) => m.values[Y.id]),
    [plot.y + plot.h, plot.y],
    logY,
    0.08,
    Y.unit,
  )
  const px = (m: Model) => xs(date(m))
  const py = (m: Model) => ys(m.values[Y.id])

  const xTicks = xs.ticks(plot.w / (120 * s)).map((d) => d.getTime())
  const yTicks = ticksFor(ys, logY, 6, Y.unit)
  const rad = 6.5 * s
  const anyHl = r.models.some(r.isHighlighted)

  // ---- labels on record setters ----
  const mode2 = spec.options.labels
  const reqs = r.models
    .filter((m) =>
      mode2 === 'all'
        ? true
        : mode2 === 'none'
          ? false
          : mode2 === 'highlight'
            ? r.isHighlighted(m)
            : isRecord.has(m.id) || r.isHighlighted(m),
    )
    .map((m) => ({
      id: m.id,
      text: tx(m.name),
      x: px(m),
      y: py(m),
      r: rad,
      force: r.isHighlighted(m),
      priority: (r.isHighlighted(m) ? 2000 : 0) + (isRecord.has(m.id) ? 1000 : 0) + date(m) / 1e11,
    }))
  // step lines as obstacles: horizontal run at each record, then the jump
  const lines = recs.flatMap((rec) => {
    const pts: Array<[number, number]> = []
    rec.forEach((m, k) => {
      if (k > 0) pts.push([px(m), py(rec[k - 1])])
      pts.push([px(m), py(m)])
    })
    if (rec.length) pts.push([plot.x + plot.w, py(rec[rec.length - 1])])
    return lineObstacles(pts, 6 * s)
  })
  const placed = placeLabels(reqs, plot, 15 * s, 500, lines, mode2 === 'auto' ? 16 : Infinity)

  const ends = spreadVertically(
    groups
      .map((g, i) => {
        const last = recs[i][recs[i].length - 1]
        return last ? { key: g.key, label: tx(g.label), y: py(last), lineY: py(last) } : null
      })
      .filter((e): e is { key: string; label: string; y: number; lineY: number } => e !== null),
    endSize * 1.3,
    plot.y,
    plot.y + plot.h,
  )

  return (
    <g>
      <Label x={box.x} y={box.y + 10 * s} size={16 * s} opacity={OPACITY.muted} tracking={0.02}>
        {tx(axisTitle(Y, L, logY))}
      </Label>
      <GridY scale={ys} ticks={yTicks} box={plot} s={s} metric={Y} />
      <GridX scale={xs} ticks={xTicks} box={plot} s={s} format={(v) => monthTick(new Date(v), L)} />

      {loose.map((m) => (
        <Marker
          key={m.id}
          id={m.id}
          shape="circle"
          x={px(m)}
          y={py(m)}
          r={rad * 0.8}
          opacity={0.22}
        />
      ))}

      {groups.map((g, i) => {
        const rec = recs[i]
        const path =
          rec.length > 0
            ? line<[number, number]>().curve(curveStepAfter)([
                ...rec.map((m) => [px(m), py(m)] as [number, number]),
                [plot.x + plot.w, py(rec[rec.length - 1])],
              ])
            : null
        return (
          <g key={g.key}>
            {g.models.map((m) => {
              const hl = r.isHighlighted(m)
              const base = anyHl ? (hl ? 1 : 0.3) : isRecord.has(m.id) ? 1 : 0.32
              const op =
                spec.options.color !== 'none'
                  ? r.tone(m) * (isRecord.has(m.id) || hl ? 1 : 0.45)
                  : base
              return (
                <Marker
                  key={m.id}
                  id={m.id}
                  shape={g.shape}
                  x={px(m)}
                  y={py(m)}
                  r={hl ? rad * 1.25 : rad}
                  opacity={op}
                  filled={g.shape !== 'ring'}
                />
              )
            })}
            {path && (
              <path
                d={path}
                fill="none"
                stroke={ink(mode === 'none' ? 0.85 : 1)}
                strokeWidth={3 * s}
                strokeDasharray={scaleDash(g.dash, s)}
                strokeLinejoin="round"
              />
            )}
          </g>
        )
      })}

      {mode !== 'none' &&
        ends.map((e) => (
          <Label key={e.key} x={plot.x + plot.w + 14 * s} y={e.y} size={endSize} weight={600}>
            {e.label}
          </Label>
        ))}

      {placed.map((p) => (
        <g key={p.id} data-id={p.id}>
          {p.leader && <line {...p.leader} stroke={white(0.5)} strokeWidth={1.2 * s} />}
          <Label x={p.x} y={p.y} size={15 * s} anchor={p.anchor} opacity={0.95}>
            {p.text}
          </Label>
        </g>
      ))}
    </g>
  )
}

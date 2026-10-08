import { line } from 'd3-shape'
import { effortRank } from '../lib/effort.ts'
import { formatValue, axisTitle } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { measure } from '../lib/text.ts'
import type { Model } from '../lib/types.ts'
import { type ChartProps, Empty, GridX, GridY, ticksFor, valueScale } from './axes.tsx'
import { lineObstacles, placeLabels } from './labels.ts'
import { Legend, type LegendItem } from './Legend.tsx'
import { Label, Marker } from './primitives.tsx'
import { OPACITY, type Shape, tint, white } from './theme.ts'

// models nobody beats on both axes at once
export function paretoFrontier(
  models: Model[],
  x: string,
  y: string,
  xHigh: boolean,
  yHigh: boolean,
): Model[] {
  const sorted = [...models].sort((a, b) =>
    xHigh ? b.values[x] - a.values[x] : a.values[x] - b.values[x],
  )
  const out: Model[] = []
  let best = -Infinity
  for (const m of sorted) {
    const v = yHigh ? m.values[y] : -m.values[y]
    if (v > best) {
      out.push(m)
      best = v
    }
  }
  return out
}

export function Scatter({ r, box, s, tx }: ChartProps) {
  const { spec } = r
  const X = r.metric(spec.x)
  const Y = r.metric(spec.y)
  if (!X || !Y || r.models.length === 0)
    return <Empty box={box} s={s} text={tx(t('noData', spec.locale))} />
  const L = spec.locale
  const { logX, logY } = spec.options

  const yTicksProbe = valueScale(
    r.models.map((m) => m.values[Y.id]),
    [0, 1],
    logY,
  )
  const tickW = Math.max(
    ...ticksFor(yTicksProbe, logY, 6, Y.unit).map((v) =>
      measure(formatValue(v, Y.unit, true), 16 * s),
    ),
  )
  const plot = {
    x: box.x + tickW + 18 * s,
    y: box.y + 44 * s,
    w: box.w - tickW - 18 * s - 8 * s,
    h: box.h - 44 * s - 74 * s,
  }
  const xs = valueScale(
    r.models.map((m) => m.values[X.id]),
    [plot.x, plot.x + plot.w],
    logX,
    0.08,
    X.unit,
  )
  const ys = valueScale(
    r.models.map((m) => m.values[Y.id]),
    [plot.y + plot.h, plot.y],
    logY,
    0.08,
    Y.unit,
  )
  // families whose efforts share an x (same price per token) are nudged apart
  // so their columns do not sit on top of each other
  const dodge = new Map<string, number>()
  const px = (m: Model) => xs(m.values[X.id]) + (m.family ? (dodge.get(m.family) ?? 0) : 0)
  const py = (m: Model) => ys(m.values[Y.id])

  const frontier = spec.options.frontier
    ? paretoFrontier(r.models, X.id, Y.id, X.higherIsBetter, Y.higherIsBetter)
    : []
  const onFrontier = new Set(frontier.map((m) => m.id))
  const anyHl = r.models.some(r.isHighlighted)

  const series = spec.options.series
  const shapeOf = (m: Model): Shape =>
    series === 'lab' ? r.shapeOf(m.lab) : series === 'weights' && m.openWeights ? 'ring' : 'circle'
  const legend: LegendItem[] =
    series === 'lab'
      ? r.labsShown.slice(0, 7).map((lab) => ({ label: tx(r.lab(lab)), shape: r.shapeOf(lab) }))
      : series === 'weights'
        ? [
            { label: tx(t('closedWeights', L)), shape: 'circle' },
            { label: tx(t('openWeights', L)), shape: 'ring' },
          ]
        : []
  if (frontier.length > 1) legend.push({ label: tx(t('paretoFrontier', L)), dash: '10 7' })

  // efforts of one model, joined from lowest to highest
  const families = new Map<string, Model[]>()
  for (const m of r.models)
    if (m.family) (families.get(m.family) ?? families.set(m.family, []).get(m.family)!).push(m)
  for (const vs of families.values()) vs.sort((a, b) => effortRank(a.effort) - effortRank(b.effort))
  const columns = [...families.entries()]
    .filter(([, vs]) => vs.length > 1)
    .map(([f, vs]) => ({
      f,
      x: xs(vs[0].values[X.id]),
      spread:
        Math.max(...vs.map((v) => xs(v.values[X.id]))) -
        Math.min(...vs.map((v) => xs(v.values[X.id]))),
    }))
    .filter((c) => c.spread < 4 * s)
    .sort((a, b) => a.x - b.x)
  const gap = 18 * s
  for (let i = 0; i < columns.length;) {
    let j = i
    while (j + 1 < columns.length && columns[j + 1].x - columns[j].x < gap) j++
    const n = j - i + 1
    for (let k = 0; k < n; k++) dodge.set(columns[i + k].f, (k - (n - 1) / 2) * gap)
    i = j + 1
  }
  const fewFamilies = families.size <= 4
  const baseName = (m: Model) => m.name.replace(/\s*\([^)]*\)\s*$/, '')

  const bestOf = new Map(
    [...families.entries()].map(([f, vs]) => [
      f,
      [...vs].sort((a, b) =>
        Y.higherIsBetter ? b.values[Y.id] - a.values[Y.id] : a.values[Y.id] - b.values[Y.id],
      )[0].id,
    ]),
  )

  const rad = 7 * s
  const labelSize = 16 * s
  const mode = spec.options.labels
  const isTop = (m: Model) => !m.family || bestOf.get(m.family) === m.id
  const reqs = r.models
    .filter(
      (m) => mode === 'all' || mode === 'auto' || (mode === 'highlight' && r.isHighlighted(m)),
    )
    // effort names only where they fit: few models, or the highlighted ones
    .filter((m) => isTop(m) || mode === 'all' || fewFamilies || r.isHighlighted(m))
    .map((m) => ({
      id: m.id,
      // a family is named once, at its best run; the other runs show their effort
      text: tx(!m.family ? m.name : isTop(m) ? baseName(m) : (m.effort ?? m.name)),
      x: px(m),
      y: py(m),
      r: rad,
      // every effort family gets its name, with a leader line if it must move
      force: r.isHighlighted(m) || (!!m.family && isTop(m) && families.size <= 16),
      priority:
        (r.isHighlighted(m) ? 2000 : 0) +
        (onFrontier.has(m.id) ? 1000 : 0) +
        (m.family && bestOf.get(m.family) === m.id ? 500 : 0) +
        (Y.higherIsBetter ? -py(m) : py(m)) / 10,
    }))
  const labelBounds = { x: plot.x + 4 * s, y: plot.y, w: plot.w - 4 * s, h: plot.h }
  const corner = cornerBox(plot, X.higherIsBetter, Y.higherIsBetter, s, L, tx)
  const lines = [...families.values()].flatMap((vs) =>
    lineObstacles(
      vs.map((m) => [px(m), py(m)] as [number, number]),
      5 * s,
    ),
  )
  lines.push(
    ...lineObstacles(
      frontier.map((m) => [px(m), py(m)] as [number, number]),
      6 * s,
    ),
  )
  const placed =
    mode === 'none'
      ? []
      : placeLabels(
          reqs,
          labelBounds,
          labelSize,
          500,
          [corner.box, ...lines],
          mode === 'auto' ? 22 : Infinity,
        )
  // a family whose name did not fit at its best run tries its other runs
  if (mode !== 'none') {
    const named = new Set(
      placed
        .filter((p) => r.models.find((m) => m.id === p.id && m.family && isTop(m)))
        .map((p) => p.id),
    )
    const boxes = () =>
      placed.map((p) => {
        const w = measure(p.text, labelSize, 500)
        const x = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - w : p.x - w / 2
        return { x, y: p.y - labelSize * 0.6, w, h: labelSize * 1.2 }
      })
    for (const [f, vs] of families) {
      const top = bestOf.get(f)!
      if (vs.length < 2 || named.has(top) || families.size > 16) continue
      for (const v of [...vs].reverse()) {
        if (v.id === top || placed.some((p) => p.id === v.id)) continue
        const got = placeLabels(
          [
            {
              id: v.id,
              text: tx(baseName(v)),
              x: px(v),
              y: py(v),
              r: rad,
              priority: 0,
              force: true,
            },
          ],
          labelBounds,
          labelSize,
          500,
          [corner.box, ...lines, ...boxes()],
        )
        if (got.length) {
          placed.push(...got)
          break
        }
      }
    }
  }
  const labelled = new Set(placed.map((p) => p.id))

  // the tone of a model: its opacity step, dimmed when others are starred,
  // solid white when it is starred itself
  const opOf = (m: Model) => {
    if (r.isHighlighted(m)) return 1
    if (spec.options.color !== 'none') return r.tone(m) * (anyHl ? 0.6 : 1)
    if (anyHl) return 0.4
    return labelled.has(m.id) || onFrontier.has(m.id) || m.family ? 1 : 0.6
  }
  const groupMap = new Map<string, Model[]>()
  for (const m of r.models) {
    const k = m.family ?? m.id
    ;(groupMap.get(k) ?? groupMap.set(k, []).get(k)!).push(m)
  }
  const groups = [...groupMap.entries()]
    .map(([key, ms]) => ({
      key,
      models: ms.sort((a, b) => effortRank(a.effort) - effortRank(b.effort)),
    }))
    .sort(
      (a, b) =>
        Number(r.isHighlighted(a.models[0])) - Number(r.isHighlighted(b.models[0])) ||
        opOf(a.models[0]) - opOf(b.models[0]),
    )

  const frontierPath = line<Model>().x(px).y(py)(frontier)

  const xTicks = ticksFor(xs, logX, 7, X.unit)
  const yTicks = ticksFor(ys, logY, 6, Y.unit)

  return (
    <g>
      <Label x={box.x} y={box.y + 10 * s} size={16 * s} opacity={OPACITY.muted} tracking={0.02}>
        {tx(axisTitle(Y, L, logY))}
      </Label>
      {legend.length > 0 && <Legend items={legend} x={box.x + box.w} y={box.y + 10 * s} s={s} />}
      <GridY scale={ys} ticks={yTicks} box={plot} s={s} metric={Y} />
      <GridX
        scale={xs}
        ticks={xTicks}
        box={plot}
        s={s}
        format={(v) => formatValue(v, X.unit, true)}
      />
      <Label
        x={plot.x + plot.w}
        y={plot.y + plot.h + 60 * s}
        size={16 * s}
        opacity={OPACITY.muted}
        anchor="end"
        tracking={0.02}
      >
        {tx(axisTitle(X, L, logX))}
      </Label>

      {corner.node}

      {frontierPath && frontier.length > 1 && (
        <path
          d={frontierPath}
          fill="none"
          stroke={white(0.75)}
          strokeWidth={2.5 * s}
          strokeDasharray={`${10 * s} ${7 * s}`}
        />
      )}

      {/* one solid group per model (its effort line and points), faint ones
          first. tints instead of transparency, so nothing shows through */}
      {groups.map((g) => {
        const op = opOf(g.models[0])
        const hl = r.isHighlighted(g.models[0])
        return (
          <g key={g.key}>
            {g.models.length > 1 && (
              <path
                d={line<Model>().x(px).y(py)(g.models) ?? ''}
                fill="none"
                stroke={tint(op)}
                strokeWidth={(hl ? 3.5 : 2.5) * s}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {g.models.map((m) => (
              <Marker
                key={m.id}
                id={m.id}
                shape={shapeOf(m)}
                x={px(m)}
                y={py(m)}
                r={hl ? rad * 1.25 : rad}
                opacity={op}
              />
            ))}
          </g>
        )
      })}

      {placed.map((p) => {
        const m = r.models.find((mm) => mm.id === p.id)!
        const hl = r.isHighlighted(m)
        return (
          <g key={p.id} data-id={p.id}>
            {p.leader && <line {...p.leader} stroke={white(0.5)} strokeWidth={1.2 * s} />}
            <Label
              x={p.x}
              y={p.y}
              size={labelSize}
              weight={hl ? 700 : 500}
              opacity={Math.max(opOf(m), 0.7)}
              anchor={p.anchor}
            >
              {p.text}
            </Label>
          </g>
        )
      })}
    </g>
  )
}

// "better" arrow in the corner where both axes improve
function cornerBox(
  plot: { x: number; y: number; w: number; h: number },
  xHigh: boolean,
  yHigh: boolean,
  s: number,
  L: 'es' | 'en',
  tx: (t: string) => string,
) {
  const text = tx(t('better', L))
  const size = 15 * s
  const w = measure(text, size, 600) + 30 * s
  const h = 26 * s
  const right = xHigh
  const top = yHigh
  const x = right ? plot.x + plot.w - w - 10 * s : plot.x + 10 * s
  const y = top ? plot.y + 8 * s : plot.y + plot.h - h - 8 * s
  const ax = right ? x + w - 8 * s : x + 8 * s
  const ay = top ? y + 5 * s : y + h - 5 * s
  const dx = right ? -1 : 1
  const dy = top ? 1 : -1
  const a = 11 * s
  const node = (
    <g opacity={OPACITY.muted}>
      <path
        d={`M${ax + dx * a},${ay + dy * a} L${ax},${ay} M${ax},${ay} l${dx * a * 0.65},0 M${ax},${ay} l0,${dy * a * 0.65}`}
        stroke={white()}
        strokeWidth={2 * s}
        strokeLinecap="round"
        fill="none"
      />
      <Label
        x={right ? ax - 18 * s : ax + 18 * s}
        y={y + h / 2}
        size={size}
        weight={600}
        anchor={right ? 'end' : 'start'}
      >
        {text}
      </Label>
    </g>
  )
  return { node, box: { x, y, w, h } }
}

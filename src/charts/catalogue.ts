// every chart the data allows, so publishing one is a click away. the curated
// templates come first; the rest is generated per source and per metric:
// a ranking for every metric, its efforts when models were run at several, a
// score vs cost when the benchmark reports cost per task, how it moved over
// time, and a table per source.
import type { Dataset, MetricDef, SourceId, Text } from '../lib/types.ts'
import { applyTemplate, type ChartSpec, DEFAULT_SPEC, type Template, TEMPLATES } from './spec.ts'

export type Kind = 'featured' | 'bars' | 'efforts' | 'scatter' | 'timeline' | 'table'

export interface Entry {
  id: string
  source: SourceId
  kind: Kind
  name: Text
  template: Template
  featured: boolean
}

export const KIND_LABEL: Record<Exclude<Kind, 'featured'>, Text> = {
  bars: { es: 'ranking', en: 'ranking' },
  efforts: { es: 'por esfuerzo', en: 'by effort' },
  scatter: { es: 'dispersión', en: 'scatter' },
  timeline: { es: 'evolución', en: 'over time' },
  table: { es: 'tabla', en: 'table' },
}

export const SOURCE_ORDER: SourceId[] = ['cursor', 'aa', 'epoch', 'lmarena', 'openrouter', 'manual']

// the metric's full name and what it measures, as a subtitle
function describe(m: MetricDef): Text {
  const line = (l: 'es' | 'en') =>
    [m.label[l], m.description?.[l]].filter(Boolean).join('. ').toLowerCase()
  return { es: line('es'), en: line('en') }
}

const vs = (a: Text, b: Text): Text => ({ es: `${a.es} vs ${b.es}`, en: `${a.en} vs ${b.en}` })
const lower = (t: Text): Text => ({ es: t.es.toLowerCase(), en: t.en.toLowerCase() })

function kindOf(t: Template): Exclude<Kind, 'featured'> {
  const type = t.spec.type ?? 'scatter'
  if (type === 'compare' || type === 'table') return 'table'
  if (type === 'bars' && t.spec.options?.efforts === 'all') return 'efforts'
  return type
}

export function catalogue(data: Dataset): Entry[] {
  const byId = new Map(data.metrics.map((m) => [m.id, m]))
  const sourceOf = (id: string | undefined) => (id ? byId.get(id)?.source : undefined)
  const out: Entry[] = []
  const seen = new Set<string>()
  const key = (t: Template) => {
    const s = t.spec
    return [
      kindOf(t),
      s.type === 'scatter' ? s.x : '',
      s.type === 'table' || s.type === 'compare' ? s.metrics?.join('+') : s.y,
    ].join('|')
  }
  const add = (source: SourceId, t: Template, featured = false) => {
    const k = key(t)
    if (seen.has(k) || out.some((e) => e.id === t.id)) return
    seen.add(k)
    // generated charts are titled by what they show
    const template = { ...t, spec: { ...t.spec, title: t.spec.title ?? t.name } }
    out.push({ id: t.id, source, kind: kindOf(t), name: t.name, template, featured })
  }

  for (const t of TEMPLATES) {
    const main =
      t.spec.type === 'table' || t.spec.type === 'compare' ? t.spec.metrics?.[0] : t.spec.y
    if (main && !byId.has(main)) continue
    add(sourceOf(main) ?? 'manual', t, true)
  }

  // models that were run at more than one effort, per metric
  const withEfforts = new Set<string>()
  const perFamily = new Map<string, number>()
  for (const m of data.models) {
    if (!m.family) continue
    for (const id of Object.keys(m.values)) {
      const k = `${id}|${m.family}`
      perFamily.set(k, (perFamily.get(k) ?? 0) + 1)
      if (perFamily.get(k)! >= 2) withEfforts.add(id)
    }
  }

  const bySource = new Map<SourceId, MetricDef[]>()
  for (const m of data.metrics)
    (bySource.get(m.source) ?? bySource.set(m.source, []).get(m.source)!).push(m)

  for (const source of SOURCE_ORDER) {
    const metrics = (bySource.get(source) ?? []).sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    for (const m of metrics) {
      const name = lower(m.short)
      const paired = m.pairedWith ? byId.get(m.pairedWith) : undefined

      add(source, {
        id: `${m.id}--ranking`,
        name: paired ? name : { es: `ranking de ${name.es}`, en: `${name.en} ranking` },
        spec: {
          type: 'bars',
          y: m.id,
          title: null,
          subtitle: describe(m),
          // a cost is shown for the models that score best, not the cheapest runs
          filter: { top: 15, sinceMonths: null, rankBy: paired ? paired.id : null },
          options: { sort: paired ? 'worst' : 'best', color: 'lab' },
        },
      })

      if (paired) continue

      if (withEfforts.has(m.id)) {
        add(source, {
          id: `${m.id}--efforts`,
          name: { es: `${name.es} por esfuerzo`, en: `${name.en} by effort` },
          spec: {
            type: 'bars',
            y: m.id,
            title: null,
            subtitle: null,
            filter: { top: 4, sinceMonths: null },
            options: { efforts: 'all', color: 'model', showLab: false },
          },
        })
      }

      // every cost, token or step count reported next to this score
      for (const c of metrics.filter((x) => x.pairedWith === m.id)) {
        add(source, {
          id: `${m.id}--vs--${c.id}`,
          name: vs(name, lower(c.short)),
          spec: {
            type: 'scatter',
            x: c.id,
            y: m.id,
            title: null,
            subtitle: null,
            filter: { top: 8, sinceMonths: 12 },
            options: {
              efforts: withEfforts.has(m.id) ? 'all' : 'best',
              frontier: !withEfforts.has(m.id),
              logX: !!c.log,
            },
          },
        })
      }

      if ((m.count ?? 0) >= 40 && m.unit !== 'usd_per_mtok' && m.category !== 'context') {
        add(source, {
          id: `${m.id}--timeline`,
          name: { es: `${name.es} en el tiempo`, en: `${name.en} over time` },
          spec: {
            type: 'timeline',
            y: m.id,
            title: null,
            subtitle: null,
            filter: { top: 400, sinceMonths: 36, pool: 'all' },
            options: { frontier: true, series: 'none', logY: !!m.log },
          },
        })
      }
    }

    // the source's own headline pairings
    const has = (...ids: string[]) => ids.every((id) => byId.has(id))
    const pair = (y: string, x: string, logX: boolean) => {
      if (!has(y, x)) return
      add(source, {
        id: `${y}--vs--${x}`,
        name: vs(lower(byId.get(y)!.short), lower(byId.get(x)!.short)),
        spec: {
          type: 'scatter',
          x,
          y,
          title: null,
          subtitle: null,
          filter: { top: 40, sinceMonths: 12 },
          options: { efforts: 'best', frontier: true, logX },
        },
      })
    }
    if (source === 'aa') {
      pair('aa-intelligence', 'aa-price-blended', true)
      pair('aa-intelligence', 'aa-speed', false)
      pair('aa-coding', 'aa-price-blended', true)
      pair('aa-speed', 'aa-price-blended', true)
      pair('aa-intelligence', 'aa-ttft', true)
    }
    if (source === 'epoch') pair('eci', 'price-blended', true)
    if (source === 'lmarena') pair('arena-text', 'price-blended', true)
    if (source === 'openrouter') pair('context', 'price-blended', true)

    const head = metrics.filter((m) => !m.pairedWith).slice(0, 5)
    if (head.length >= 2) {
      add(source, {
        id: `${source}--table`,
        name: { es: 'tabla resumen', en: 'summary table' },
        spec: {
          type: 'table',
          metrics: head.map((m) => m.id),
          title: null,
          subtitle: null,
          filter: { top: 12, rankBy: head[0].id, sinceMonths: null },
        },
      })
    }
  }
  return out
}

export function entrySpec(e: Entry, base: Pick<ChartSpec, 'format' | 'locale'>): ChartSpec {
  return applyTemplate(e.template, { ...DEFAULT_SPEC, ...base })
}

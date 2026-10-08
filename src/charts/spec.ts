import type { Dataset, Locale, MetricDef, Model, Text } from '../lib/types.ts'
import { type Shape, SHAPES } from './theme.ts'

export type ChartType = 'scatter' | 'bars' | 'timeline' | 'compare' | 'table'

export const FORMATS = {
  landscape: { w: 1600, h: 900, label: '16:9', hint: 'x, linkedin' },
  square: { w: 1080, h: 1080, label: '1:1', hint: 'x, instagram' },
  portrait: { w: 1080, h: 1350, label: '4:5', hint: 'instagram, x' },
  story: { w: 1080, h: 1920, label: '9:16', hint: 'stories, reels' },
  og: { w: 1200, h: 628, label: '1.91:1', hint: 'linkedin link, og' },
} as const
export type FormatId = keyof typeof FORMATS

export type LabelMode = 'auto' | 'all' | 'highlight' | 'none'
export type SeriesMode = 'none' | 'lab' | 'weights'
// best: one point per model, its best run. all: every reasoning effort, joined
export type EffortMode = 'best' | 'all'
// white at different opacities per lab or per model, the brand's only "colours"
export type ColorMode = 'none' | 'lab' | 'model'
export const TONES = [1, 0.75, 0.55, 0.4, 0.28]

export interface ChartSpec {
  type: ChartType
  format: FormatId
  locale: Locale
  title: Text | null // null = generated from the metrics
  subtitle: Text | null
  x: string // scatter x
  y: string // main metric for scatter, bars, timeline
  metrics: string[] // compare and table columns
  filter: {
    labs: string[] // empty = all
    weights: 'all' | 'open' | 'closed'
    sinceMonths: number | null // relative, so templates stay current
    top: number
    rankBy: string | null // pick the top n by this metric instead of y
    models: string[] // explicit pick, overrides top n
    include: string[] // always shown, on top of the top n
    exclude: string[] // never shown
  }
  highlight: string[] // model ids
  highlightLabs: string[]
  // efforts picked per model ({ "claude-opus-5-5": ["high", "max"] }). a model
  // listed here shows exactly those runs, joined; others follow options.efforts
  effortPick: Record<string, string[]>
  options: {
    labels: LabelMode
    frontier: boolean
    series: SeriesMode
    logX: boolean
    logY: boolean
    sort: 'best' | 'worst'
    lowercase: boolean
    showLab: boolean
    efforts: EffortMode
    color: ColorMode
  }
}

export const DEFAULT_SPEC: ChartSpec = {
  type: 'scatter',
  format: 'landscape',
  locale: 'es',
  title: null,
  subtitle: null,
  x: 'epoch-cursorbench-cost',
  y: 'epoch-cursorbench',
  metrics: ['eci', 'aa-intelligence', 'epoch-cursorbench', 'epoch-cursorbench-cost'],
  filter: {
    labs: [],
    weights: 'all',
    sinceMonths: 12,
    top: 40,
    rankBy: null,
    models: [],
    include: [],
    exclude: [],
  },
  highlight: [],
  highlightLabs: [],
  effortPick: {},
  options: {
    labels: 'auto',
    frontier: true,
    // brand rule for telling things apart: shape is the lab, opacity the model
    series: 'lab',
    logX: true,
    logY: false,
    sort: 'best',
    lowercase: true,
    showLab: true,
    efforts: 'best',
    color: 'model',
  },
}

export interface Template {
  id: string
  name: Text
  spec: Partial<Omit<ChartSpec, 'filter' | 'options'>> & {
    filter?: Partial<ChartSpec['filter']>
    options?: Partial<ChartSpec['options']>
  }
}

export const TEMPLATES: Template[] = [
  {
    id: 'coding-vs-cost',
    name: { es: 'programación vs coste', en: 'coding vs cost' },
    spec: {
      type: 'scatter',
      x: 'epoch-cursorbench-cost',
      y: 'epoch-cursorbench',
      title: { es: 'cuánto cuesta pensar más', en: 'what thinking harder costs' },
      subtitle: {
        es: 'cursorbench: tareas reales de programación. cada línea es un modelo de low a max: cuanto más piensa, mejor resuelve y más cuesta cada tarea.',
        en: 'cursorbench: real coding tasks. each line is one model from low to max: the more it thinks, the better it solves and the more each task costs.',
      },
      filter: { sinceMonths: 12, top: 8, labs: ['openai', 'anthropic', 'google', 'xai'] },
      options: { frontier: false, logX: true, efforts: 'all' },
    },
  },
  {
    id: 'agents-vs-cost',
    name: { es: 'agentes vs coste', en: 'agents vs cost' },
    spec: {
      type: 'scatter',
      x: 'epoch-deepswe-cost',
      y: 'epoch-deepswe',
      title: {
        es: 'agentes de software: acierto frente a coste',
        en: 'software agents: success vs cost',
      },
      subtitle: {
        es: 'deepswe: tareas de ingeniería de varios pasos. coste medio por tarea en cada nivel de esfuerzo.',
        en: 'deepswe: multi-step engineering tasks. mean cost per task at each effort level.',
      },
      filter: { sinceMonths: 12, top: 8, labs: ['openai', 'anthropic', 'google', 'xai'] },
      options: { frontier: false, logX: true, efforts: 'all' },
    },
  },
  {
    id: 'reasoning-vs-cost',
    name: { es: 'razonamiento vs coste', en: 'reasoning vs cost' },
    spec: {
      type: 'scatter',
      x: 'epoch-arc-agi-2-cost',
      y: 'epoch-arc-agi-2',
      title: { es: 'razonar cuesta', en: 'reasoning has a price' },
      subtitle: {
        es: 'arc-agi-2: puzles de razonamiento abstracto. coste por tarea en cada nivel de esfuerzo.',
        en: 'arc-agi-2: abstract reasoning puzzles. cost per task at each effort level.',
      },
      filter: { sinceMonths: 12, top: 8 },
      options: { frontier: false, logX: true, efforts: 'all' },
    },
  },
  {
    id: 'cost-ranking',
    name: { es: 'coste por tarea', en: 'cost per task' },
    spec: {
      type: 'bars',
      y: 'epoch-cursorbench-cost',
      title: { es: 'cuánto cuesta una tarea', en: 'what one task costs' },
      subtitle: {
        es: 'coste por tarea en cursorbench de los 15 mejores modelos, en su mejor nivel de esfuerzo.',
        en: 'cost per cursorbench task for the 15 best models, at their best effort level.',
      },
      filter: { top: 15, rankBy: 'epoch-cursorbench', sinceMonths: null },
      options: { sort: 'worst', color: 'lab' },
    },
  },
  {
    id: 'eci-ranking',
    name: { es: 'ranking de inteligencia', en: 'intelligence ranking' },
    spec: {
      type: 'bars',
      y: 'eci',
      title: { es: 'los modelos más capaces', en: 'the most capable models' },
      subtitle: {
        es: 'índice de capacidades de epoch (eci), combinación de decenas de benchmarks.',
        en: 'epoch capabilities index (eci), a blend of dozens of benchmarks.',
      },
      filter: { top: 15, sinceMonths: null },
    },
  },
  {
    id: 'aa-ranking',
    name: { es: 'ranking artificial analysis', en: 'artificial analysis ranking' },
    spec: {
      type: 'bars',
      y: 'aa-intelligence',
      title: {
        es: 'inteligencia según artificial analysis',
        en: 'intelligence by artificial analysis',
      },
      subtitle: {
        es: 'índice de inteligencia de artificial analysis, mejor nivel de esfuerzo de cada modelo.',
        en: 'artificial analysis intelligence index, best effort level of each model.',
      },
      filter: { top: 15, sinceMonths: 12 },
    },
  },
  {
    id: 'speed',
    name: { es: 'velocidad', en: 'speed' },
    spec: {
      type: 'bars',
      y: 'aa-speed',
      title: { es: 'los más rápidos', en: 'the fastest' },
      subtitle: {
        es: 'tokens de salida por segundo, mediana medida por artificial analysis. modelos del último año.',
        en: 'output tokens per second, median measured by artificial analysis. models from the last year.',
      },
      filter: { top: 15, sinceMonths: 12, rankBy: 'aa-speed' },
      options: { color: 'lab' },
    },
  },
  {
    id: 'eci-timeline',
    name: { es: 'la carrera por la frontera', en: 'the frontier race' },
    spec: {
      type: 'timeline',
      y: 'eci',
      title: { es: 'la carrera por la frontera', en: 'the frontier race' },
      subtitle: {
        es: 'mejor índice de capacidades de epoch por laboratorio a lo largo del tiempo.',
        en: 'best epoch capabilities index per lab over time.',
      },
      filter: {
        sinceMonths: 36,
        top: 400,
        labs: ['openai', 'anthropic', 'google', 'xai', 'deepseek'],
      },
      options: { frontier: true, series: 'lab', logY: false },
    },
  },
  {
    id: 'open-vs-closed',
    name: { es: 'abiertos vs cerrados', en: 'open vs closed' },
    spec: {
      type: 'timeline',
      y: 'eci',
      title: { es: 'pesos abiertos frente a cerrados', en: 'open weights vs closed weights' },
      subtitle: {
        es: 'mejor modelo de cada grupo según el índice de capacidades de epoch.',
        en: 'best model in each group by the epoch capabilities index.',
      },
      filter: { sinceMonths: 36, top: 400 },
      options: { frontier: true, series: 'weights' },
    },
  },
  {
    id: 'arena-ranking',
    name: { es: 'ranking lmarena', en: 'lmarena ranking' },
    spec: {
      type: 'bars',
      y: 'arena-text',
      title: { es: 'lo que prefiere la gente', en: 'what people prefer' },
      subtitle: {
        es: 'elo de lmarena (texto), votos ciegos comparando respuestas por parejas.',
        en: 'lmarena text elo, blind votes comparing answers head to head.',
      },
      filter: { top: 15, sinceMonths: null },
    },
  },
  {
    id: 'coding',
    name: { es: 'programación', en: 'coding' },
    spec: {
      type: 'bars',
      y: 'epoch-frontiercode',
      title: { es: 'quién programa mejor', en: 'who codes best' },
      subtitle: {
        es: 'frontiercode (cognition): tareas de programación agéntica, media de 5 intentos.',
        en: 'frontiercode (cognition): agentic coding tasks, mean of 5 attempts.',
      },
      filter: { top: 12, sinceMonths: null },
    },
  },
  {
    id: 'metr-horizon',
    name: { es: 'horizonte metr', en: 'metr time horizon' },
    spec: {
      type: 'timeline',
      y: 'metr-horizon',
      title: { es: 'cuánto trabajo aguanta la ia sola', en: 'how long ai can work alone' },
      subtitle: {
        es: 'duración de tareas de software que el modelo completa con un 50% de éxito (metr).',
        en: 'length of software tasks a model completes with 50% success (metr).',
      },
      filter: { sinceMonths: null, top: 400 },
      options: { frontier: true, logY: true, series: 'none' },
    },
  },
  {
    id: 'compare-frontier',
    name: { es: 'comparativa frontera', en: 'frontier comparison' },
    spec: {
      type: 'compare',
      metrics: [
        'eci',
        'epoch-gpqa-diamond',
        'epoch-frontiercode',
        'epoch-frontiermath-tiers-1-3-v2-private',
        'epoch-cursorbench',
        'epoch-cursorbench-cost',
      ],
      title: { es: 'cara a cara en la frontera', en: 'head to head at the frontier' },
      subtitle: null,
      filter: { top: 4, rankBy: 'eci', sinceMonths: null },
    },
  },
  {
    id: 'leaderboard',
    name: { es: 'tabla resumen', en: 'leaderboard table' },
    spec: {
      type: 'table',
      metrics: [
        'eci',
        'aa-intelligence',
        'arena-text',
        'epoch-cursorbench',
        'epoch-cursorbench-cost',
      ],
      title: { es: 'el estado de la ia', en: 'the state of ai' },
      subtitle: null,
      filter: { top: 10, rankBy: 'eci', sinceMonths: null },
    },
  },
]

// charts saved before cost per task existed (in a link or the url) used list
// prices per token. those never move with effort, so they are swapped for the
// cost per task of the same benchmark, or for cursorbench when there is none.
export function normalizeSpec(spec: ChartSpec, data: Dataset): ChartSpec {
  const unit = (id: string) => data.metrics.find((m) => m.id === id)?.unit
  const exists = (id: string) => data.metrics.some((m) => m.id === id)
  let out = spec
  if (
    spec.type === 'scatter' &&
    (unit(spec.x) === 'usd_per_mtok' || unit(spec.y) === 'usd_per_mtok')
  ) {
    const paired = `${spec.y}-cost`
    out = exists(paired)
      ? { ...spec, x: paired, options: { ...spec.options, logX: true } }
      : {
          ...spec,
          y: 'epoch-cursorbench',
          x: 'epoch-cursorbench-cost',
          title: null,
          subtitle: null,
          options: { ...spec.options, logX: true },
        }
  }
  if (unit(out.y) === 'usd_per_mtok')
    out = { ...out, y: 'epoch-cursorbench-cost', title: null, subtitle: null }
  const metrics = out.metrics.map((id) =>
    unit(id) === 'usd_per_mtok' ? 'epoch-cursorbench-cost' : id,
  )
  return { ...out, metrics: [...new Set(metrics)] }
}

export function applyTemplate(t: Template, base: ChartSpec = DEFAULT_SPEC): ChartSpec {
  return {
    ...DEFAULT_SPEC,
    format: base.format,
    locale: base.locale,
    ...t.spec,
    filter: { ...DEFAULT_SPEC.filter, ...t.spec.filter },
    options: { ...DEFAULT_SPEC.options, lowercase: base.options.lowercase, ...t.spec.options },
    highlight: t.spec.highlight ?? [],
    highlightLabs: t.spec.highlightLabs ?? [],
    effortPick: t.spec.effortPick ?? {},
  }
}

// ---- url state --------------------------------------------------------------

export function encodeSpec(spec: ChartSpec): string {
  const bytes = new TextEncoder().encode(JSON.stringify(spec))
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function decodeSpec(hash: string): ChartSpec | null {
  try {
    const b64 = hash.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ChartSpec>
    return {
      ...DEFAULT_SPEC,
      ...raw,
      filter: { ...DEFAULT_SPEC.filter, ...raw.filter },
      options: { ...DEFAULT_SPEC.options, ...raw.options },
      effortPick: raw.effortPick ?? {},
    }
  } catch {
    return null
  }
}

// ---- selection --------------------------------------------------------------

export interface Resolved {
  spec: ChartSpec
  models: Model[]
  // everything the chart could show, best first, to pick what is visible
  candidates: Model[]
  shown: Set<string>
  familyOf: (m: Model) => string
  // opacity for the colour mode, 1 when it is off
  tone: (m: Model) => number
  toneLegend: Array<{ label: string; opacity: number }>
  // one shape per lab, stable for a given selection, shared with the sidebar
  shapeOf: (lab: string) => Shape
  labsShown: string[]
  metric: (id: string) => MetricDef | undefined
  lab: (id: string) => string
  isHighlighted: (m: Model) => boolean
}

export function sinceDate(months: number | null, now = new Date()): string | null {
  if (!months) return null
  const d = new Date(now)
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

// metrics a chart type needs every model to have
export function requiredMetrics(spec: ChartSpec): string[] {
  switch (spec.type) {
    case 'scatter':
      return [spec.x, spec.y]
    case 'bars':
    case 'timeline':
      return [spec.y]
    case 'compare':
    case 'table':
      return []
  }
}

export function resolve(data: Dataset, spec: ChartSpec): Resolved {
  const metrics = new Map(data.metrics.map((m) => [m.id, m]))
  const labs = new Map(data.labs.map((l) => [l.id, l.name]))
  const byId = new Map(data.models.map((m) => [m.id, m]))
  const f = spec.filter
  const since = sinceDate(f.sinceMonths)
  const req = requiredMetrics(spec)
  const columns = spec.metrics.filter((id) => metrics.has(id))
  const rankBy =
    f.rankBy && metrics.has(f.rankBy)
      ? f.rankBy
      : spec.type === 'compare' || spec.type === 'table'
        ? columns[0]
        : spec.y
  const rankDef = rankBy ? metrics.get(rankBy) : undefined
  const familyOf = (m: Model) => m.family ?? m.id

  const eligible = (m: Model) => {
    if (!req.every((id) => m.values[id] !== undefined)) return false
    if (spec.type === 'timeline' && !m.releaseDate) return false
    if (
      (spec.type === 'compare' || spec.type === 'table') &&
      !columns.some((id) => m.values[id] !== undefined)
    )
      return false
    return true
  }

  // one group per model: its base entry, or every effort variant that has the
  // data when efforts are on
  const variantsOf = new Map<string, Model[]>()
  for (const m of data.models)
    if (m.family) (variantsOf.get(m.family) ?? variantsOf.set(m.family, []).get(m.family)!).push(m)
  const groups: Model[][] = []
  for (const m of data.models) {
    if (m.family) continue
    const pick = spec.effortPick[m.id]
    const vs = pick?.length
      ? (variantsOf.get(m.id) ?? []).filter((v) => pick.includes(v.effort!) && eligible(v))
      : spec.options.efforts === 'all'
        ? (variantsOf.get(m.id) ?? []).filter(eligible)
        : []
    if (vs.length) groups.push(vs)
    else if (eligible(m)) groups.push([m])
  }
  const score = (g: Model[]) => {
    if (!rankDef) return 0
    const vals = g.map((m) => m.values[rankDef.id]).filter((v) => v !== undefined)
    if (!vals.length) return -Infinity
    return rankDef.higherIsBetter ? Math.max(...vals) : -Math.min(...vals)
  }
  groups.sort((a, b) => score(b) - score(a))

  const excluded = new Set(f.exclude)
  const isOut = (g: Model[]) => excluded.has(familyOf(g[0]))
  let picked: Model[][]
  if (f.models.length) {
    const order = new Map(f.models.map((id, i) => [byId.get(id)?.family ?? id, i]))
    picked = groups
      .filter((g) => order.has(familyOf(g[0])))
      .sort((a, b) => order.get(familyOf(a[0]))! - order.get(familyOf(b[0]))!)
  } else {
    picked = groups
      .filter((g) => {
        const m = byId.get(familyOf(g[0])) ?? g[0]
        if (f.labs.length && !f.labs.includes(m.lab)) return false
        if (f.weights === 'open' && m.openWeights !== true) return false
        if (f.weights === 'closed' && m.openWeights !== false) return false
        if (since && (!m.releaseDate || m.releaseDate < since)) return false
        return !rankDef || score(g) > -Infinity
      })
      .filter((g) => !isOut(g))
      .slice(0, f.top)
  }
  const forced = new Set(f.include)
  for (const g of groups) if (forced.has(familyOf(g[0])) && !picked.includes(g)) picked.push(g)
  picked = picked.filter((g) => !isOut(g))
  const models = picked.flat()
  const shown = new Set(models.map(familyOf))

  // tones: the best labs or models get the strongest white
  const mode = spec.options.color
  const keyOf = (m: Model) => (mode === 'lab' ? m.lab : familyOf(m))
  const order: string[] = []
  for (const g of picked) {
    const k = keyOf(g[0])
    if (!order.includes(k)) order.push(k)
  }
  // opacity steps from solid white down to 0.3, best first
  const step = (i: number) =>
    order.length <= TONES.length ? TONES[i] : 1 - (0.7 * i) / (order.length - 1)
  const toneOf = new Map(order.map((k, i) => [k, step(i)]))
  const toneLegend =
    mode === 'none' || order.length > 8
      ? []
      : order.map((k, i) => ({
          label: mode === 'lab' ? (labs.get(k) ?? k) : (byId.get(k)?.name ?? k),
          opacity: step(i),
        }))

  // shapes follow the picked labs in order, otherwise the labs with most models
  const labCount = new Map<string, number>()
  for (const m of models) labCount.set(m.lab, (labCount.get(m.lab) ?? 0) + 1)
  const labsShown = [...labCount.keys()].sort((a, b) => {
    const ia = f.labs.indexOf(a)
    const ib = f.labs.indexOf(b)
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    return labCount.get(b)! - labCount.get(a)!
  })
  const shapeIdx = new Map(labsShown.map((l, i) => [l, i]))

  const hl = new Set(spec.highlight)
  const hlLabs = new Set(spec.highlightLabs)
  return {
    spec,
    models,
    candidates: groups.map((g) => byId.get(familyOf(g[0])) ?? g[0]),
    shown,
    familyOf,
    tone: (m) => (mode === 'none' ? 1 : (toneOf.get(keyOf(m)) ?? 0.3)),
    toneLegend,
    shapeOf: (lab) => {
      const i = shapeIdx.get(lab) ?? (f.labs.includes(lab) ? f.labs.indexOf(lab) : -1)
      return i >= 0 && i < SHAPES.length - 1 ? SHAPES[i] : 'ring'
    },
    labsShown,
    metric: (id) => metrics.get(id),
    lab: (id) => labs.get(id) ?? id,
    isHighlighted: (m) => hl.has(m.id) || hl.has(familyOf(m)) || hlLabs.has(m.lab),
  }
}

export function autoTitle(spec: ChartSpec, r: Resolved): { title: string; subtitle: string } {
  const L = spec.locale
  const y = r.metric(spec.y)?.label[L] ?? spec.y
  const x = r.metric(spec.x)?.label[L] ?? spec.x
  const vs = L === 'es' ? 'frente a' : 'vs'
  const title =
    spec.title?.[L] ??
    (spec.type === 'scatter'
      ? `${y} ${vs} ${x}`
      : spec.type === 'compare'
        ? L === 'es'
          ? 'comparativa de modelos'
          : 'model comparison'
        : spec.type === 'table'
          ? L === 'es'
            ? 'tabla de modelos'
            : 'model table'
          : y)
  return { title, subtitle: spec.subtitle?.[L] ?? '' }
}

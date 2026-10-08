// shared between the data pipeline (scripts/) and the app (src/)

export type Locale = 'es' | 'en'
export type Text = Record<Locale, string>

export type SourceId = 'epoch' | 'openrouter' | 'lmarena' | 'aa' | 'manual'

export interface SourceMeta {
  id: SourceId
  name: string
  url: string
  license: string
  // short credit line printed on exported charts
  credit: string
  fetchedAt: string | null
  ok: boolean
  note?: string
}

export type MetricCategory = 'intelligence' | 'benchmark' | 'arena' | 'cost' | 'speed' | 'context'

export type MetricUnit =
  | 'index' // unitless score (eci, aa index)
  | 'elo'
  | 'fraction' // 0..1, shown as %
  | 'usd_per_mtok'
  | 'usd' // dollars per task or run
  | 'tokens'
  | 'tokens_per_s'
  | 'seconds'
  | 'minutes'

export interface MetricDef {
  id: string
  label: Text
  short: Text // compact label for axes and tables
  unit: MetricUnit
  category: MetricCategory
  source: SourceId
  higherIsBetter: boolean
  log?: boolean // log scale reads better (prices, context, time horizons)
  description?: Text
  count?: number // models with a value, filled by the pipeline
  // a cost that only means something next to its score (cost per task of a
  // benchmark). it always comes from the same run as the score it pairs with.
  pairedWith?: string
}

export interface Lab {
  id: string
  name: string
}

export interface Model {
  id: string
  name: string
  lab: string // Lab.id
  releaseDate: string | null // yyyy-mm-dd
  openWeights: boolean | null
  values: Record<string, number>
  // variants: one model run at one reasoning effort, joined to its base model
  family?: string // base Model.id
  effort?: string // none, low, medium, high, xhigh, max, thinking, 32k...
  // raw identifiers per source, for debugging matches
  refs: Partial<Record<SourceId, string[]>>
}

export interface Dataset {
  generatedAt: string
  sources: SourceMeta[]
  metrics: MetricDef[]
  labs: Lab[]
  models: Model[]
}

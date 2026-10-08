// artificial analysis: intelligence index, speed and latency. needs a free api
// key in AA_API_KEY (https://artificialanalysis.ai/documentation). their terms
// ask for attribution, which every exported chart carries.
import type { MetricDef, SourceMeta } from '../../src/lib/types.ts'
import { fetchJson, isoDate, log, num, type SourceRow } from '../lib.ts'

interface AAModel {
  id: string
  name: string
  slug: string
  release_date?: string
  model_creator?: { name?: string; slug?: string }
  evaluations?: Record<string, number | null>
  pricing?: Record<string, number | null>
  median_output_tokens_per_second?: number | null
  median_time_to_first_token_seconds?: number | null
}

const META: SourceMeta = {
  id: 'aa',
  name: 'Artificial Analysis',
  url: 'https://artificialanalysis.ai',
  license: 'attribution required',
  credit: 'artificial analysis',
  fetchedAt: null,
  ok: false,
}

const EVALS: Array<[key: string, id: string, es: string, en: string, short: string]> = [
  [
    'artificial_analysis_intelligence_index',
    'aa-intelligence',
    'Índice de inteligencia de Artificial Analysis',
    'Artificial Analysis Intelligence Index',
    'AA intelligence',
  ],
  [
    'artificial_analysis_coding_index',
    'aa-coding',
    'Índice de programación de Artificial Analysis',
    'Artificial Analysis Coding Index',
    'AA coding',
  ],
  [
    'artificial_analysis_math_index',
    'aa-math',
    'Índice de matemáticas de Artificial Analysis',
    'Artificial Analysis Math Index',
    'AA math',
  ],
]

export const AA_METRICS: MetricDef[] = [
  ...EVALS.map(([, id, es, en, short]): MetricDef => ({
    id,
    label: { es, en },
    short: { es: short, en: short },
    unit: 'index',
    category: 'intelligence',
    source: 'aa',
    higherIsBetter: true,
  })),
  {
    id: 'aa-price-blended',
    label: {
      es: 'Precio por millón de tokens (3:1, AA)',
      en: 'Price per million tokens (3:1, AA)',
    },
    short: { es: 'precio 3:1 (AA)', en: 'price 3:1 (AA)' },
    unit: 'usd_per_mtok',
    category: 'cost',
    source: 'aa',
    higherIsBetter: false,
    log: true,
  },
  {
    id: 'aa-speed',
    label: { es: 'Velocidad de salida (tokens/s)', en: 'Output speed (tokens/s)' },
    short: { es: 'velocidad', en: 'speed' },
    unit: 'tokens_per_s',
    category: 'speed',
    source: 'aa',
    higherIsBetter: true,
  },
  {
    id: 'aa-ttft',
    label: { es: 'Latencia hasta el primer token', en: 'Time to first token' },
    short: { es: 'latencia', en: 'ttft' },
    unit: 'seconds',
    category: 'speed',
    source: 'aa',
    higherIsBetter: false,
    log: true,
  },
]

export async function artificialAnalysis() {
  const key = process.env.AA_API_KEY
  if (!key) {
    log('artificial analysis: skipped (set AA_API_KEY in .env to enable)')
    return { meta: { ...META, note: 'AA_API_KEY not set' }, metrics: [], rows: [] }
  }
  const { json, fetchedAt } = await fetchJson<{ data: AAModel[] }>(
    'https://artificialanalysis.ai/api/v2/data/llms/models',
    'aa/models.json',
    { headers: { 'x-api-key': key } },
  )
  const rows: SourceRow[] = json.data.map((m) => {
    const values: Record<string, number> = {}
    for (const [k, id] of EVALS) {
      const v = num(m.evaluations?.[k])
      if (v !== null) values[id] = v
    }
    const price = num(m.pricing?.price_1m_blended_3_to_1)
    if (price) values['aa-price-blended'] = price
    const speed = num(m.median_output_tokens_per_second)
    if (speed) values['aa-speed'] = speed
    const ttft = num(m.median_time_to_first_token_seconds)
    if (ttft) values['aa-ttft'] = ttft
    return {
      source: 'aa',
      rawId: m.slug || m.id,
      name: m.name,
      lab: m.model_creator?.name ?? m.model_creator?.slug,
      releaseDate: isoDate(m.release_date),
      values,
    }
  })
  log(`artificial analysis: ${rows.length} models`)
  return { meta: { ...META, fetchedAt, ok: true }, metrics: AA_METRICS, rows }
}

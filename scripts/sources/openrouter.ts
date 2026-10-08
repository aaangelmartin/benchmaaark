// openrouter: list prices and context windows for ~500 models.
// https://openrouter.ai/docs/api-reference/list-available-models
import type { MetricDef, SourceMeta } from '../../src/lib/types.ts'
import { fetchJson, isoDate, log, num, type SourceRow } from '../lib.ts'

interface OpenRouterModel {
  id: string
  name: string
  created: number
  context_length: number | null
  hugging_face_id: string | null
  pricing: { prompt: string; completion: string }
}

const PER_M = 1_000_000

export const PRICE_METRICS: MetricDef[] = [
  {
    id: 'price-blended',
    label: { es: 'Precio por millón de tokens (3:1)', en: 'Price per million tokens (3:1)' },
    short: { es: 'precio 3:1', en: 'price 3:1' },
    unit: 'usd_per_mtok',
    category: 'cost',
    source: 'openrouter',
    higherIsBetter: false,
    log: true,
    description: {
      es: 'media ponderada de 3 tokens de entrada por 1 de salida, en usd por millón.',
      en: 'weighted average of 3 input tokens per output token, usd per million.',
    },
  },
  {
    id: 'price-input',
    label: { es: 'Precio de entrada por millón de tokens', en: 'Input price per million tokens' },
    short: { es: 'precio entrada', en: 'input price' },
    unit: 'usd_per_mtok',
    category: 'cost',
    source: 'openrouter',
    higherIsBetter: false,
    log: true,
  },
  {
    id: 'price-output',
    label: { es: 'Precio de salida por millón de tokens', en: 'Output price per million tokens' },
    short: { es: 'precio salida', en: 'output price' },
    unit: 'usd_per_mtok',
    category: 'cost',
    source: 'openrouter',
    higherIsBetter: false,
    log: true,
  },
  {
    id: 'context',
    label: { es: 'Ventana de contexto', en: 'Context window' },
    short: { es: 'contexto', en: 'context' },
    unit: 'tokens',
    category: 'context',
    source: 'openrouter',
    higherIsBetter: true,
    log: true,
  },
]

export async function openrouter() {
  const { json, fetchedAt } = await fetchJson<{ data: OpenRouterModel[] }>(
    'https://openrouter.ai/api/v1/models',
    'openrouter/models.json',
  )
  const rows: SourceRow[] = []
  for (const m of json.data) {
    if (m.id.endsWith(':free') || m.id.startsWith('openrouter/')) continue
    const input = num(m.pricing?.prompt)
    const output = num(m.pricing?.completion)
    // negative prices mark routers with dynamic pricing
    if (input === null || output === null || input < 0 || output < 0) continue
    const values: Record<string, number> = {}
    if (input > 0 || output > 0) {
      values['price-input'] = input * PER_M
      values['price-output'] = output * PER_M
      values['price-blended'] = ((3 * input + output) / 4) * PER_M
    }
    const ctx = num(m.context_length)
    if (ctx) values.context = ctx
    rows.push({
      source: 'openrouter',
      rawId: m.id,
      name: m.name.replace(/^[^:]{1,40}:\s+/, ''),
      lab: m.id.split('/')[0],
      releaseDate: isoDate(m.created),
      openWeights: m.hugging_face_id ? true : null,
      values,
    })
  }
  log(`openrouter: ${rows.length} models`)
  const meta: SourceMeta = {
    id: 'openrouter',
    name: 'OpenRouter',
    url: 'https://openrouter.ai/models',
    license: 'public api',
    credit: 'openrouter',
    fetchedAt,
    ok: true,
  }
  return { meta, metrics: PRICE_METRICS, rows }
}

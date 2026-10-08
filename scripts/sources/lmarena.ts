// lmarena: human-preference elo, published daily as a hugging face dataset.
// https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset
import type { MetricDef, SourceMeta, Text } from '../../src/lib/types.ts'
import { fetchJson, log, num, setMax, type SourceRow, warn } from '../lib.ts'

const BOARDS: Array<{ config: string; id: string; es: string; en: string; short: Text }> = [
  {
    config: 'text',
    id: 'arena-text',
    es: 'LMArena texto (Elo)',
    en: 'LMArena text (Elo)',
    short: { es: 'arena texto', en: 'arena text' },
  },
  {
    config: 'webdev',
    id: 'arena-webdev',
    es: 'LMArena webdev (Elo)',
    en: 'LMArena webdev (Elo)',
    short: { es: 'arena webdev', en: 'arena webdev' },
  },
  {
    config: 'vision',
    id: 'arena-vision',
    es: 'LMArena visión (Elo)',
    en: 'LMArena vision (Elo)',
    short: { es: 'arena visión', en: 'arena vision' },
  },
  {
    config: 'search',
    id: 'arena-search',
    es: 'LMArena búsqueda (Elo)',
    en: 'LMArena search (Elo)',
    short: { es: 'arena búsqueda', en: 'arena search' },
  },
]

interface ArenaRow {
  model_name: string
  organization: string
  license: string
  rating: number
  vote_count: number
  category: string
  leaderboard_publish_date: string
}

async function board(config: string): Promise<ArenaRow[]> {
  const out: ArenaRow[] = []
  for (let offset = 0; offset < 2000; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=lmarena-ai/leaderboard-dataset&config=${config}&split=latest&offset=${offset}&length=100`
    const { json } = await fetchJson<{ rows: Array<{ row: ArenaRow }>; num_rows_total: number }>(
      url,
      `lmarena/${config}-${offset}.json`,
    )
    out.push(...json.rows.map((r) => r.row))
    if (offset + 100 >= json.num_rows_total) break
  }
  return out
}

export async function lmarena() {
  const metrics: MetricDef[] = []
  const byModel = new Map<string, SourceRow>()
  let published = ''
  for (const b of BOARDS) {
    let data: ArenaRow[]
    try {
      data = await board(b.config)
    } catch (err) {
      warn(`lmarena ${b.config}: ${(err as Error).message}`)
      continue
    }
    const overall = data.filter((r) => r.category === 'overall')
    if (!overall.length) continue
    for (const r of overall)
      if (r.leaderboard_publish_date > published) published = r.leaderboard_publish_date
    metrics.push({
      id: b.id,
      label: { es: b.es, en: b.en },
      short: b.short,
      unit: 'elo',
      category: 'arena',
      source: 'lmarena',
      higherIsBetter: true,
      description: {
        es: 'votos ciegos de usuarios comparando respuestas por parejas.',
        en: 'blind user votes comparing answers head to head.',
      },
    })
    for (const r of overall) {
      const row =
        byModel.get(r.model_name) ??
        ({
          source: 'lmarena',
          rawId: r.model_name,
          name: r.model_name,
          lab: r.organization,
          openWeights: r.license ? !/proprietary/i.test(r.license) : null,
          values: {},
        } satisfies SourceRow)
      setMax(row.values, b.id, num(r.rating))
      byModel.set(r.model_name, row)
    }
  }
  const rows = [...byModel.values()]
  log(`lmarena: ${rows.length} models, ${metrics.length} boards (published ${published})`)
  const meta: SourceMeta = {
    id: 'lmarena',
    name: 'LMArena',
    url: 'https://lmarena.ai/leaderboard',
    license: 'CC BY 4.0',
    credit: 'lmarena',
    fetchedAt: published ? `${published}T00:00:00.000Z` : null,
    ok: rows.length > 0,
  }
  return { meta, metrics, rows }
}

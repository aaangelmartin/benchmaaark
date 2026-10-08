// cursorbench, read straight from cursor's leaderboard page. epoch republishes
// it, but days later; the page itself has every model at every reasoning
// effort with its score, average cost per task and tokens per task.
// https://cursor.com/cursorbench
import type { MetricDef, SourceMeta } from '../../src/lib/types.ts'
import { fetchCached, log, type SourceRow } from '../lib.ts'

const URL = 'https://cursor.com/cursorbench'

const EFFORTS: Record<string, string> = {
  max: 'max',
  'extra high': 'xhigh',
  high: 'high',
  medium: 'medium',
  low: 'low',
  minimal: 'minimal',
  none: 'none',
}

// the page uses short names ("Opus 5.5"); these give them their lab and the
// full name the other sources use
const FAMILIES: Array<[RegExp, string, string]> = [
  [/^(opus|sonnet|haiku|fable|mythos)\b/i, 'Anthropic', 'Claude '],
  [/^gpt/i, 'OpenAI', ''],
  [/^grok/i, 'xAI', ''],
  [/^gemini/i, 'Google', ''],
  [/^glm/i, 'Z.ai', ''],
  [/^muse/i, 'Meta', ''],
  [/^composer/i, 'Cursor', ''],
  [/^(kimi)/i, 'Moonshot', ''],
  [/^deepseek/i, 'DeepSeek', ''],
  [/^qwen/i, 'Alibaba', ''],
]

export const CURSOR_METRICS: MetricDef[] = [
  {
    id: 'cursorbench',
    label: { es: 'CursorBench', en: 'CursorBench' },
    short: { es: 'cursorbench', en: 'cursorbench' },
    unit: 'fraction',
    category: 'benchmark',
    source: 'cursor',
    higherIsBetter: true,
    description: {
      es: 'tareas reales de programación de cursor, medidas en cada nivel de esfuerzo.',
      en: 'real coding tasks from cursor, measured at every effort level.',
    },
  },
  {
    id: 'cursorbench-cost',
    label: { es: 'Coste por tarea en CursorBench', en: 'Cost per task on CursorBench' },
    short: { es: 'coste por tarea', en: 'cost per task' },
    unit: 'usd',
    category: 'cost',
    source: 'cursor',
    higherIsBetter: false,
    log: true,
    pairedWith: 'cursorbench',
    description: {
      es: 'coste medio de resolver una tarea de cursorbench en ese nivel de esfuerzo.',
      en: 'average cost of solving one cursorbench task at that effort level.',
    },
  },
  {
    id: 'cursorbench-tokens',
    label: { es: 'Tokens por tarea en CursorBench', en: 'Tokens per task on CursorBench' },
    short: { es: 'tokens por tarea', en: 'tokens per task' },
    unit: 'tokens',
    category: 'cost',
    source: 'cursor',
    higherIsBetter: false,
    log: true,
    pairedWith: 'cursorbench',
  },
  {
    id: 'cursorbench-steps',
    label: { es: 'Pasos por tarea en CursorBench', en: 'Steps per task on CursorBench' },
    short: { es: 'pasos por tarea', en: 'steps per task' },
    unit: 'index',
    category: 'cost',
    source: 'cursor',
    higherIsBetter: false,
    pairedWith: 'cursorbench',
  },
]

const strip = (s: string) =>
  s
    .replace(/<!--.*?-->/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .trim()

export function parseCursorBench(html: string) {
  const rows = new Map<
    string,
    {
      name: string
      effort: string | null
      score: number
      cost: number
      tokens: number | null
      steps: number | null
    }
  >()
  for (const tr of html.split(/<tr[\s>]/).slice(1)) {
    const name = tr.match(/<span class="truncate">([^<]+)<\/span>/)?.[1]
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]))
    const score = cells.find((c) => /^\d+(\.\d+)?%$/.test(c))
    const cost = cells.find((c) => /^\$\d+(\.\d+)?$/.test(c))
    if (!name || !score || !cost) continue
    // after the cost come tokens per task, then steps per task
    const [tokens, steps] = cells.slice(cells.indexOf(cost) + 1).filter((c) => /^[\d,]+$/.test(c))
    const m = name.trim().match(/^(.*?)(?:\s+(max|extra high|high|medium|low|minimal|none))?$/i)!
    const effort = m[2] ? EFFORTS[m[2].toLowerCase()] : null
    rows.set(name.trim(), {
      name: m[1],
      effort,
      score: Number(score.slice(0, -1)) / 100,
      cost: Number(cost.slice(1)),
      tokens: tokens ? Number(tokens.replace(/,/g, '')) : null,
      steps: steps ? Number(steps.replace(/,/g, '')) : null,
    })
  }
  return [...rows.values()]
}

export async function cursorbench() {
  const { body, fetchedAt } = await fetchCached(URL, 'cursor/cursorbench.html', {
    headers: { 'user-agent': 'Mozilla/5.0 (benchmaaark; +https://nglmrtn.com/benchmaaark)' },
  })
  const parsed = parseCursorBench(body.toString('utf8'))
  if (parsed.length < 10)
    throw new Error(`only ${parsed.length} rows parsed, the page layout may have changed`)
  const rows: SourceRow[] = parsed.map((p) => {
    const fam = FAMILIES.find(([re]) => re.test(p.name))
    const full = `${fam?.[2] ?? ''}${p.name}`
    const values: Record<string, number> = { cursorbench: p.score, 'cursorbench-cost': p.cost }
    if (p.tokens) values['cursorbench-tokens'] = p.tokens
    if (p.steps) values['cursorbench-steps'] = p.steps
    return {
      source: 'cursor',
      // effort suffix in epoch's style, so the shared parser reads it
      rawId: p.effort ? `${full}_${p.effort}` : full,
      name: full,
      lab: fam?.[1] ?? null,
      values,
    }
  })
  log(`cursorbench: ${rows.length} runs of ${new Set(parsed.map((p) => p.name)).size} models`)
  const meta: SourceMeta = {
    id: 'cursor',
    name: 'CursorBench',
    url: URL,
    license: 'public leaderboard',
    credit: 'cursorbench',
    fetchedAt,
    ok: true,
  }
  return { meta, metrics: CURSOR_METRICS, rows }
}

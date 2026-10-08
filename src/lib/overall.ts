// one number to rank models across sources. each headline index uses its own
// scale (a percentage, an elo, an index), so a model's standing in each is
// turned into a percentile among all models that have it, and the overall is
// the average of the percentiles it has. it always says how many indices are
// behind it: a model measured by one source is not as settled as one with four.
import type { Dataset, Model } from './types.ts'

export const OVERALL_METRICS = ['cursorbench', 'aa-intelligence', 'eci', 'arena-text']

export interface Overall {
  score: number // 0..100
  n: number // indices behind it
}

export function overallScores(data: Dataset): Map<string, Overall> {
  const ids = OVERALL_METRICS.filter((id) => data.metrics.some((m) => m.id === id))
  const byId = new Map(data.models.map((m) => [m.id, m]))
  // percentiles are taken among base models, so adding effort variants does
  // not shift everyone's standing
  const sorted = new Map(
    ids.map((id) => [
      id,
      data.models
        .filter((m) => !m.family && m.values[id] !== undefined)
        .map((m) => m.values[id])
        .sort((a, b) => a - b),
    ]),
  )
  const percentile = (id: string, v: number) => {
    const list = sorted.get(id)!
    if (list.length < 2) return 100
    let lo = 0
    let hi = list.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (list[mid] <= v) lo = mid + 1
      else hi = mid
    }
    return (100 * (lo - 1)) / (list.length - 1)
  }
  // an effort variant uses its own result where it has one, and its model's
  // result for the indices that are not measured per effort
  const valueOf = (m: Model, id: string) =>
    m.values[id] ?? (m.family ? byId.get(m.family)?.values[id] : undefined)

  const out = new Map<string, Overall>()
  for (const m of data.models) {
    const parts = ids
      .map((id) => [id, valueOf(m, id)] as const)
      .filter((p): p is readonly [string, number] => p[1] !== undefined)
    if (!parts.length) continue
    const score =
      parts.reduce((sum, [id, v]) => sum + Math.max(0, Math.min(100, percentile(id, v))), 0) /
      parts.length
    out.set(m.id, { score, n: parts.length })
  }
  return out
}

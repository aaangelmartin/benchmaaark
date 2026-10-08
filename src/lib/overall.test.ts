import { describe, expect, it } from 'vitest'
import { overallScores } from './overall.ts'
import type { Dataset, MetricDef, Model } from './types.ts'

const metric = (id: string): MetricDef => ({
  id,
  label: { es: id, en: id },
  short: { es: id, en: id },
  unit: 'index',
  category: 'intelligence',
  source: 'manual',
  higherIsBetter: true,
})
const model = (id: string, values: Record<string, number>, family?: string): Model => ({
  id,
  name: id,
  lab: 'x',
  releaseDate: null,
  openWeights: null,
  values,
  refs: {},
  family,
  effort: family ? 'low' : undefined,
})
const data = (models: Model[]): Dataset => ({
  generatedAt: '',
  sources: [],
  labs: [],
  metrics: [metric('eci'), metric('arena-text')],
  models,
})

describe('overallScores', () => {
  it('averages the percentiles of the indices a model has', () => {
    const o = overallScores(
      data([
        model('a', { eci: 160, 'arena-text': 1500 }),
        model('b', { eci: 150, 'arena-text': 1400 }),
        model('c', { eci: 140 }),
      ]),
    )
    expect(o.get('a')).toEqual({ score: 100, n: 2 })
    expect(o.get('b')).toEqual({ score: 25, n: 2 }) // 50th in eci, last in arena
    expect(o.get('c')).toEqual({ score: 0, n: 1 })
  })

  it('leaves out models with none of the indices', () => {
    expect(overallScores(data([model('a', { eci: 1 }), model('z', { other: 5 })])).has('z')).toBe(
      false,
    )
  })

  it('gives an effort its own result and the result of its model for the rest', () => {
    const o = overallScores(
      data([
        model('a', { eci: 160, 'arena-text': 1500 }),
        model('b', { eci: 140, 'arena-text': 1400 }),
        model('a--low', { eci: 140 }, 'a'),
      ]),
    )
    expect(o.get('a--low')).toEqual({ score: 50, n: 2 }) // last in eci, top in arena through its model
  })
})

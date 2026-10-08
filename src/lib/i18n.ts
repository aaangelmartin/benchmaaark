import type { Locale } from './types.ts'

const STRINGS = {
  sources: { es: 'fuentes', en: 'sources' },
  dataAsOf: { es: 'datos a', en: 'data as of' },
  releaseDate: { es: 'fecha de lanzamiento', en: 'release date' },
  better: { es: 'mejor', en: 'better' },
  frontier: { es: 'frontera', en: 'frontier' },
  paretoFrontier: { es: 'frontera de pareto', en: 'pareto frontier' },
  openWeights: { es: 'pesos abiertos', en: 'open weights' },
  closedWeights: { es: 'pesos cerrados', en: 'closed weights' },
  model: { es: 'modelo', en: 'model' },
  lab: { es: 'laboratorio', en: 'lab' },
  noData: { es: 'no hay datos para esta combinación', en: 'no data for this combination' },
  others: { es: 'otros', en: 'others' },
  bestSoFar: { es: 'mejor modelo hasta la fecha', en: 'best model to date' },
} satisfies Record<string, Record<Locale, string>>

export type StringKey = keyof typeof STRINGS
export const t = (key: StringKey, locale: Locale) => STRINGS[key][locale]

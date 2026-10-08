import type { Locale, MetricDef, MetricUnit } from './types.ts'

const trim = (s: string) => s.replace(/\.0+$|(\.\d*?)0+$/, '$1')

export function formatValue(v: number, unit: MetricUnit, compact = false): string {
  switch (unit) {
    case 'fraction': {
      const p = v * 100
      return `${p >= 10 || compact ? Math.round(p) : trim(p.toFixed(1))}%`
    }
    case 'elo':
      return String(Math.round(v))
    case 'index':
      return v >= 1000 ? Math.round(v).toLocaleString('en-US') : trim(v.toFixed(compact ? 0 : 1))
    case 'usd_per_mtok':
      return `$${v >= 100 ? Math.round(v) : v >= 10 ? trim(v.toFixed(1)) : trim(v.toFixed(v < 0.1 ? 3 : 2))}`
    case 'usd':
      return `$${v >= 100 ? Math.round(v) : v >= 10 ? trim(v.toFixed(1)) : trim(v.toFixed(2))}`
    case 'tokens':
      return v >= 1e6 ? `${trim((v / 1e6).toFixed(1))}M` : `${Math.round(v / 1e3)}k`
    case 'tokens_per_s':
      return `${Math.round(v)} t/s`
    case 'seconds':
      return `${trim(v.toFixed(v < 10 ? 1 : 0))}s`
    case 'minutes':
      if (v < 1) return `${Math.round(v * 60)} s`
      if (v < 60) return `${Math.round(v)} min`
      if (v < 60 * 24) return `${trim((v / 60).toFixed(1))} h`
      return `${trim((v / 1440).toFixed(1))} d`
  }
}

export const fmt = (m: MetricDef, v: number, compact = false) => formatValue(v, m.unit, compact)

const UNIT_SUFFIX: Record<MetricUnit, Record<Locale, string>> = {
  index: { es: '', en: '' },
  elo: { es: '', en: '' },
  fraction: { es: '%', en: '%' },
  usd_per_mtok: { es: 'usd / 1M tokens', en: 'usd / 1M tokens' },
  usd: { es: 'usd', en: 'usd' },
  tokens: { es: 'tokens', en: 'tokens' },
  tokens_per_s: { es: 'tokens/s', en: 'tokens/s' },
  seconds: { es: 'segundos', en: 'seconds' },
  minutes: { es: 'escala log', en: 'log scale' },
}

export function axisTitle(m: MetricDef, locale: Locale, log: boolean): string {
  const extra = [
    UNIT_SUFFIX[m.unit][locale],
    log && m.unit !== 'minutes' ? (locale === 'es' ? 'escala log' : 'log scale') : '',
  ]
    .filter(Boolean)
    .join(', ')
  return extra ? `${m.label[locale]} (${extra})` : m.label[locale]
}

const MONTHS: Record<Locale, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
}

export function formatDate(iso: string, locale: Locale, withDay = true): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const month = MONTHS[locale][m - 1]
  return withDay ? `${d} ${month} ${y}` : `${month} ${y}`
}

export function monthTick(d: Date, locale: Locale): string {
  const m = d.getUTCMonth()
  return m === 0 ? String(d.getUTCFullYear()) : MONTHS[locale][m]
}

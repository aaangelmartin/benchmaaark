// every model in one sortable, filterable table, ranked by an overall score
// across sources, one row per model or one per reasoning effort.
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { seriesKey, sinceDate } from '../charts/spec.ts'
import { effortRank } from '../lib/effort.ts'
import { formatValue } from '../lib/format.ts'
import { getLang, L, useLang } from '../lib/lang.ts'
import { OVERALL_METRICS, overallScores } from '../lib/overall.ts'
import type { Dataset, MetricDef, Model } from '../lib/types.ts'
import { LabLogo } from './LabLogo.tsx'
import { inputClass } from './ui.tsx'

// the columns after "overall", when the data has them
const COLUMNS = [
  'cursorbench',
  'cursorbench-cost',
  'aa-intelligence',
  'eci',
  'arena-text',
  'aa-speed',
]

type SortKey = 'overall' | 'name' | 'lab' | 'release' | string
const PAGE = 150

export function Leaderboard({ data, onSelect }: { data: Dataset; onSelect: (id: string) => void }) {
  useLang()
  const lang = getLang()
  const [q, setQ] = useState('')
  const [efforts, setEfforts] = useState<'best' | 'all'>('best')
  const [scope, setScope] = useState<'latest' | 'all'>('latest')
  const [weights, setWeights] = useState<'all' | 'open' | 'closed'>('all')
  // a model measured by a single source can land anywhere: by default it takes two
  const [minN, setMinN] = useState(2)
  const [labs, setLabs] = useState<string[]>([])
  const [moreLabs, setMoreLabs] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'overall', dir: -1 })
  const [limit, setLimit] = useState(PAGE)

  const overall = useMemo(() => overallScores(data), [data])
  const byId = useMemo(() => new Map(data.models.map((m) => [m.id, m])), [data])
  const labName = useMemo(() => new Map(data.labs.map((l) => [l.id, l.name])), [data])
  const cols = useMemo(
    () =>
      COLUMNS.map((id) => data.metrics.find((m) => m.id === id)).filter((m): m is MetricDef => !!m),
    [data],
  )
  const base = (m: Model) => (m.family ? (byId.get(m.family) ?? m) : m)
  const value = (m: Model, id: string) =>
    m.values[id] ?? (m.family ? byId.get(m.family)?.values[id] : undefined)

  // the latest model of each line of each lab, as in the editor
  const latest = useMemo(() => {
    const cutoff = sinceDate(18)!
    const best = new Map<string, Model>()
    for (const m of data.models) {
      if (m.family || !overall.has(m.id)) continue
      const k = `${m.lab}|${seriesKey(m.name)}`
      const cur = best.get(k)
      if (!cur || (m.releaseDate ?? '') > (cur.releaseDate ?? '')) best.set(k, m)
    }
    return new Set(
      [...best.values()].filter((m) => !m.releaseDate || m.releaseDate >= cutoff).map((m) => m.id),
    )
  }, [data, overall])

  // labs with their number of models, the ones with the best model first
  const labCounts = useMemo(() => {
    const c = new Map<string, { n: number; best: number }>()
    for (const m of data.models) {
      if (m.family || !overall.has(m.id) || (scope === 'latest' && !latest.has(m.id))) continue
      if (overall.get(m.id)!.n < minN) continue
      const e = c.get(m.lab) ?? { n: 0, best: 0 }
      e.n++
      e.best = Math.max(e.best, overall.get(m.id)!.score)
      c.set(m.lab, e)
    }
    return [...c.entries()]
      .filter(([l]) => l !== 'other')
      .sort((a, b) => b[1].best - a[1].best)
      .map(([l, e]) => [l, e.n] as [string, number])
  }, [data, overall, scope, latest, minN])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    // an effort only earns its own row when one of the ranked indices was
    // measured at that effort; otherwise it would repeat its model's numbers
    const own = (m: Model) => OVERALL_METRICS.some((id) => m.values[id] !== undefined)
    const hasEfforts = new Set(data.models.filter((m) => m.family && own(m)).map((m) => m.family!))
    const list = data.models.filter((m) => {
      const b = base(m)
      if (!overall.has(m.id) || (m.family && !own(m))) return false
      if (overall.get(m.id)!.n < minN) return false
      // one row per model, or one per effort for the models that have efforts
      if (efforts === 'best' ? m.family : !m.family && hasEfforts.has(m.id)) return false
      if (scope === 'latest' && !latest.has(b.id)) return false
      if (labs.length && !labs.includes(b.lab)) return false
      if (weights === 'open' && b.openWeights !== true) return false
      if (weights === 'closed' && b.openWeights !== false) return false
      return !needle || `${m.name} ${labName.get(b.lab) ?? b.lab}`.toLowerCase().includes(needle)
    })
    const key = (m: Model): string | number | undefined => {
      if (sort.key === 'overall') return overall.get(m.id)?.score
      if (sort.key === 'name') return m.name.toLowerCase()
      if (sort.key === 'lab') return (labName.get(base(m).lab) ?? '').toLowerCase()
      if (sort.key === 'release') return base(m).releaseDate ?? undefined
      return value(m, sort.key)
    }
    return list.sort((a, b) => {
      const x = key(a)
      const y = key(b)
      // rows without the value always go last, whatever the direction
      if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || effortRank(b.effort) - effortRank(a.effort)
    })
  }, [data, overall, latest, q, efforts, scope, weights, labs, sort, minN]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setLimit(PAGE), [q, efforts, scope, weights, labs, sort, minN])

  // the first click on a column puts its best value on top
  const sortBy = (key: SortKey, bestDir: 1 | -1) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: bestDir }))

  const bar = useRef<HTMLDivElement>(null)
  const [barH, setBarH] = useState(150)
  useEffect(() => {
    if (!bar.current) return
    const ro = new ResizeObserver(([e]) =>
      setBarH(Math.round(e.target.getBoundingClientRect().height)),
    )
    ro.observe(bar.current)
    return () => ro.disconnect()
  }, [])

  const Th = ({
    id,
    best,
    right,
    children,
    title,
  }: {
    id: SortKey
    best: 1 | -1
    right?: boolean
    children: ReactNode
    title?: string
  }) => (
    <th
      className={`py-2.5 font-semibold whitespace-nowrap ${right ? 'pl-4 text-right' : 'pr-4 text-left'}`}
    >
      <button
        onClick={() => sortBy(id, best)}
        title={title}
        className={`lowercase transition-opacity hover:opacity-100 ${sort.key === id ? 'text-white opacity-100' : 'opacity-70'}`}
      >
        {children}
        <span className="ml-1 inline-block w-2">
          {sort.key === id ? (sort.dir === 1 ? '↑' : '↓') : ''}
        </span>
      </button>
    </th>
  )
  const shownLabs = moreLabs ? labCounts : labCounts.slice(0, 10)
  const visible = rows.slice(0, limit)
  const indexNames = OVERALL_METRICS.map((id) =>
    data.metrics.find((m) => m.id === id)?.short[lang].toLowerCase(),
  ).filter(Boolean)

  return (
    <div className="pb-12">
      <div className="mx-auto max-w-7xl px-4 pt-12 pb-10 md:px-6">
        <h1 className="mb-3 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
          {L('clasificación', 'leaderboard')}
        </h1>
        <p className="max-w-2xl text-white-80">
          {L(
            `todos los modelos ordenados por su puntuación general: la media de su percentil en ${indexNames.join(', ')}, contando solo los índices que cada modelo tiene. pulsa una columna para ordenar por ella y una fila para ver la ficha.`,
            `every model ranked by its overall score: the average of its percentile in ${indexNames.join(', ')}, counting only the indices each model has. click a column to sort by it and a row to open the model.`,
          )}
        </p>
      </div>

      <div ref={bar} className="sticky top-14 z-20 border-b border-white-20 bg-bg">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={L('buscar modelo o laboratorio', 'search model or lab')}
              className={`${inputClass} !w-60 !rounded-full !py-1 text-xs`}
            />
            <Row label={L('filas', 'rows')}>
              <Chip on={efforts === 'best'} onClick={() => setEfforts('best')}>
                {L('una por modelo', 'one per model')}
              </Chip>
              <Chip on={efforts === 'all'} onClick={() => setEfforts('all')}>
                {L('una por esfuerzo', 'one per effort')}
              </Chip>
            </Row>
            <Row label={L('modelos', 'models')}>
              <Chip
                on={scope === 'latest'}
                onClick={() => setScope('latest')}
                title={L(
                  'el más reciente de cada línea de cada laboratorio',
                  'the most recent of each line of each lab',
                )}
              >
                {L('últimos', 'latest')}
              </Chip>
              <Chip on={scope === 'all'} onClick={() => setScope('all')}>
                {L('todos', 'all')}
              </Chip>
            </Row>
            <Row label={L('índices', 'indices')}>
              {[1, 2, 3].map((n) => (
                <Chip
                  key={n}
                  on={minN === n}
                  onClick={() => setMinN(n)}
                  title={L(
                    `solo modelos con al menos ${n} de los ${OVERALL_METRICS.length} índices`,
                    `only models with at least ${n} of the ${OVERALL_METRICS.length} indices`,
                  )}
                >
                  {n}+
                </Chip>
              ))}
            </Row>
            <Row label={L('pesos', 'weights')}>
              <Chip on={weights === 'all'} onClick={() => setWeights('all')}>
                {L('todos', 'all')}
              </Chip>
              <Chip on={weights === 'open'} onClick={() => setWeights('open')}>
                {L('abiertos', 'open')}
              </Chip>
              <Chip on={weights === 'closed'} onClick={() => setWeights('closed')}>
                {L('cerrados', 'closed')}
              </Chip>
            </Row>
            <span className="ml-auto text-xs text-white-50">
              {rows.length} {L('filas', 'rows')}
            </span>
          </div>
          <Row label={L('labs', 'labs')}>
            <Chip on={labs.length === 0} onClick={() => setLabs([])}>
              {L('todos', 'all')}
            </Chip>
            {shownLabs.map(([l, n]) => (
              <Chip
                key={l}
                on={labs.includes(l)}
                onClick={() =>
                  setLabs(labs.includes(l) ? labs.filter((x) => x !== l) : [...labs, l])
                }
              >
                <LabLogo lab={l} name={labName.get(l) ?? l} className="h-3.5 w-3.5" />
                {(labName.get(l) ?? l).toLowerCase()}{' '}
                <span className="font-medium opacity-60">{n}</span>
              </Chip>
            ))}
            {labCounts.length > 10 && (
              <button
                onClick={() => setMoreLabs(!moreLabs)}
                className="px-1 text-xs text-white-50 hover:text-white"
              >
                {moreLabs ? L('menos', 'fewer') : `+${labCounts.length - 10}`}
              </button>
            )}
          </Row>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <table className="w-full text-sm">
          <thead style={{ top: 56 + barH }} className="sticky z-10 bg-bg text-xs text-white-50">
            <tr className="border-b border-white-50">
              <th className="w-10 py-2.5 pr-2 text-left font-semibold">#</th>
              <Th id="name" best={1}>
                {L('modelo', 'model')}
              </Th>
              <Th id="lab" best={1}>
                {L('laboratorio', 'lab')}
              </Th>
              <Th id="release" best={-1}>
                {L('lanzamiento', 'release')}
              </Th>
              <Th
                id="overall"
                best={-1}
                right
                title={L(
                  'media de percentiles en los índices que tiene',
                  'average percentile across the indices it has',
                )}
              >
                {L('general', 'overall')}
              </Th>
              {cols.map((c) => (
                <Th
                  key={c.id}
                  id={c.id}
                  best={c.higherIsBetter ? -1 : 1}
                  right
                  title={c.label[lang]}
                >
                  {c.short[lang]}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white-10">
            {visible.map((m, i) => {
              const b = base(m)
              const o = overall.get(m.id)!
              return (
                <tr
                  key={m.id}
                  onClick={() => onSelect(b.id)}
                  className="cursor-pointer transition-colors hover:bg-white-10"
                >
                  <td className="py-2.5 pr-2 font-semibold text-white-50 tabular-nums">{i + 1}</td>
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold lowercase">{b.name}</span>
                      {m.effort && (
                        <span className="rounded-full border border-white-30 px-2 py-px text-[0.7rem] font-semibold text-white-80">
                          {m.effort}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="pr-4">
                    <span className="flex items-center gap-2 text-white-80 lowercase">
                      <LabLogo lab={b.lab} name={labName.get(b.lab) ?? b.lab} className="h-4 w-4" />
                      {labName.get(b.lab) ?? b.lab}
                    </span>
                  </td>
                  <td className="pr-4 whitespace-nowrap text-white-80 tabular-nums">
                    {b.releaseDate?.slice(0, 7) ?? '-'}
                  </td>
                  <td className="pl-4 text-right whitespace-nowrap">
                    <span className="font-bold tabular-nums">{o.score.toFixed(1)}</span>
                    <span
                      className="ml-1.5 text-[0.7rem] text-white-50"
                      title={L(
                        `basada en ${o.n} de ${OVERALL_METRICS.length} índices`,
                        `based on ${o.n} of ${OVERALL_METRICS.length} indices`,
                      )}
                    >
                      {o.n}/{OVERALL_METRICS.length}
                    </span>
                  </td>
                  {cols.map((c) => {
                    const v = value(m, c.id)
                    return (
                      <td
                        key={c.id}
                        className={`pl-4 text-right whitespace-nowrap tabular-nums ${v === undefined ? 'text-white-30' : sort.key === c.id ? 'font-semibold' : 'text-white-80'}`}
                      >
                        {v === undefined ? '-' : formatValue(v, c.unit)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-20 text-center text-white-50">
            {L('ningún modelo con esos filtros.', 'no model matches those filters.')}
          </p>
        )}
        {rows.length > limit && (
          <div className="py-8 text-center">
            <button
              onClick={() => setLimit(limit + PAGE)}
              className="rounded-full border border-white-30 px-5 py-2 text-sm font-semibold text-white-80 hover:border-white hover:text-white"
            >
              {L(
                `ver ${Math.min(PAGE, rows.length - limit)} más de ${rows.length}`,
                `show ${Math.min(PAGE, rows.length - limit)} more of ${rows.length}`,
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs tracking-widest text-white-50">{label}</span>
      {children}
    </div>
  )
}

function Chip({
  on,
  onClick,
  children,
  title,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${on ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-80 hover:border-white hover:text-white'}`}
    >
      {children}
    </button>
  )
}

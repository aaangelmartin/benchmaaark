import { useEffect, useMemo } from 'react'
import { formatDate, formatValue } from '../lib/format.ts'
import type { Dataset, MetricCategory } from '../lib/types.ts'
import { Button } from './ui.tsx'

const CATEGORY: Record<MetricCategory, string> = {
  intelligence: 'inteligencia',
  arena: 'arena',
  benchmark: 'benchmarks',
  cost: 'coste',
  speed: 'velocidad',
  context: 'contexto',
}

// full profile of one model: every metric with its rank among all models
export function ModelDrawer({
  data,
  id,
  onClose,
  actions,
}: {
  data: Dataset
  id: string
  onClose: () => void
  actions?: Array<{ label: string; onClick: () => void }>
}) {
  const m = data.models.find((mm) => mm.id === id)

  const ranks = useMemo(() => {
    const out = new Map<string, { rank: number; of: number }>()
    if (!m) return out
    for (const d of data.metrics) {
      const v = m.values[d.id]
      if (v === undefined) continue
      const all = data.models
        .filter((x) => !x.family)
        .map((x) => x.values[d.id])
        .filter((x) => x !== undefined)
      const better = all.filter((x) => (d.higherIsBetter ? x > v : x < v)).length
      out.set(d.id, { rank: better + 1, of: all.length })
    }
    return out
  }, [data, m])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [onClose])

  if (!m) return null
  const lab = data.labs.find((l) => l.id === m.lab)?.name ?? m.lab
  const groups = (Object.keys(CATEGORY) as MetricCategory[])
    .map((cat) => ({
      cat,
      rows: data.metrics
        .filter((d) => d.category === cat && m.values[d.id] !== undefined)
        .sort(
          (a, b) =>
            ranks.get(a.id)!.rank / ranks.get(a.id)!.of -
            ranks.get(b.id)!.rank / ranks.get(b.id)!.of,
        ),
    }))
    .filter((g) => g.rows.length)

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-bg/60" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="scrollbar-thin relative h-full w-full max-w-md overflow-y-auto border-l border-white-20 bg-bg px-6 py-8"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-6 text-sm text-white-50 hover:text-white"
        >
          cerrar
        </button>
        <p className="mb-1 text-xs tracking-widest text-white-50 lowercase">{lab}</p>
        <h2 className="mb-2 text-3xl font-bold tracking-[-0.03em] lowercase">{m.name}</h2>
        <p className="mb-6 text-sm text-white-80 lowercase">
          {[
            m.releaseDate
              ? `lanzado el ${formatDate(m.releaseDate, 'es')}`
              : 'sin fecha de lanzamiento',
            m.openWeights === true
              ? 'pesos abiertos'
              : m.openWeights === false
                ? 'pesos cerrados'
                : null,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
        {actions && (
          <div className="mb-6 flex flex-wrap gap-2">
            {actions.map((a, i) => (
              <Button key={a.label} solid={i === 0} onClick={a.onClick}>
                {a.label}
              </Button>
            ))}
          </div>
        )}
        {groups.map((g) => (
          <section key={g.cat} className="border-t border-white-20 py-4">
            <h3 className="mb-3 text-xs font-semibold tracking-widest text-white-50">
              {CATEGORY[g.cat]}
            </h3>
            <div className="space-y-2">
              {g.rows.map((d) => {
                const r = ranks.get(d.id)!
                const pct = 1 - (r.rank - 1) / Math.max(1, r.of - 1)
                return (
                  <div key={d.id} title={d.label.es}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-white-80 lowercase">{d.short.es}</span>
                      <span className="shrink-0">
                        <span className="font-bold">{formatValue(m.values[d.id], d.unit)}</span>
                        <span className="ml-2 text-xs text-white-50">
                          #{r.rank} de {r.of}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-white-10">
                      <div
                        className="h-1 rounded-full bg-white"
                        style={{ width: `${Math.max(3, pct * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
        <section className="border-t border-white-20 py-4 text-xs text-white-50">
          <h3 className="mb-2 font-semibold tracking-widest">fuentes</h3>
          {Object.entries(m.refs).map(([src, ids]) => (
            <p key={src} className="break-all">
              <span className="text-white-80">
                {data.sources.find((s) => s.id === src)?.name ?? src}:
              </span>{' '}
              {ids.join(', ')}
            </p>
          ))}
        </section>
      </aside>
    </div>
  )
}

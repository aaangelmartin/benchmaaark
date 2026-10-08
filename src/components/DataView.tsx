import { useMemo, useState } from 'react'
import { formatDate, formatValue } from '../lib/format.ts'
import { getLang, L } from '../lib/lang.ts'
import type { Dataset } from '../lib/types.ts'
import { inputClass, Select } from './ui.tsx'

export function DataView({ data, onSelect }: { data: Dataset; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [metric, setMetric] = useState('eci')
  const def = data.metrics.find((m) => m.id === metric)
  const labs = useMemo(() => new Map(data.labs.map((l) => [l.id, l.name])), [data])
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return data.models
      .filter((m) => !m.family)
      .filter((m) => !s || `${m.name} ${m.lab}`.toLowerCase().includes(s))
      .filter((m) => s || m.values[metric] !== undefined)
      .sort((a, b) => {
        const va = a.values[metric]
        const vb = b.values[metric]
        if (va === undefined) return 1
        if (vb === undefined) return -1
        return def?.higherIsBetter === false ? va - vb : vb - va
      })
      .slice(0, 200)
  }, [data, q, metric, def])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <h1 className="mb-8 text-2xl font-bold tracking-[-0.03em] md:text-4xl">
        {L('modelos y fuentes', 'models and sources')}
      </h1>

      <h2 className="mb-4 text-xs font-semibold tracking-widest text-white-50">
        {L('fuentes', 'sources')}
      </h2>
      <div className="mb-12 divide-y divide-white-20 border-y border-white-20">
        {data.sources.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm"
          >
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="font-semibold lowercase hover:opacity-80"
            >
              {s.name}
            </a>
            <span className="text-white-50 lowercase">
              {s.ok
                ? `${s.license}, ${s.fetchedAt ? formatDate(s.fetchedAt, getLang()) : '-'}`
                : `${L('sin datos', 'no data')}${s.note ? `: ${s.note}` : ''}`}
            </span>
          </div>
        ))}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={L(
            `buscar entre ${data.models.filter((m) => !m.family).length} modelos`,
            `search ${data.models.filter((m) => !m.family).length} models`,
          )}
          className={inputClass}
        />
        <Select
          value={metric}
          onChange={setMetric}
          groups={[
            {
              label: L('métrica', 'metric'),
              options: data.metrics.map((m) => ({
                value: m.id,
                label: `${m.short[getLang()]} (${m.count})`,
              })),
            },
          ]}
        />
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-white-50">
          <tr className="border-b border-white-50">
            <th className="py-2 font-semibold">{L('modelo', 'model')}</th>
            <th className="font-semibold">{L('laboratorio', 'lab')}</th>
            <th className="font-semibold">{L('lanzamiento', 'release')}</th>
            <th className="text-right font-semibold">{def?.short[getLang()]}</th>
            <th className="text-right font-semibold">{L('métricas', 'metrics')}</th>
            <th className="pl-4 font-semibold">{L('fuentes', 'sources')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white-20">
          {rows.map((m) => (
            <tr
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="cursor-pointer transition-colors hover:bg-white-10"
            >
              <td className="py-2 font-semibold lowercase">{m.name}</td>
              <td className="text-white-80 lowercase">{labs.get(m.lab)}</td>
              <td className="text-white-80">{m.releaseDate ?? '-'}</td>
              <td className="text-right font-semibold">
                {def && m.values[metric] !== undefined
                  ? formatValue(m.values[metric], def.unit)
                  : '-'}
              </td>
              <td className="text-right text-white-50">{Object.keys(m.values).length}</td>
              <td className="pl-4 text-white-50">{Object.keys(m.refs).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

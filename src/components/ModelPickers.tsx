// picking models: each lab shows its lines (opus, sonnet, haiku...) and every
// version of a line is a chip. a click shows or hides it, stars it, or opens its
// reasoning efforts, depending on the mode chosen above the list.
import { type ReactNode, useMemo, useState } from 'react'
import { type ChartSpec, requiredMetrics, type Resolved, seriesKey } from '../charts/spec.ts'
import { effortRank } from '../lib/effort.ts'
import { formatValue } from '../lib/format.ts'
import { L } from '../lib/lang.ts'
import type { Dataset, MetricDef, Model } from '../lib/types.ts'
import { LabLogo } from './LabLogo.tsx'

interface Picker {
  data: Dataset
  spec: ChartSpec
  r: Resolved
  rankDef: MetricDef | undefined
  labName: (id: string) => string
  labs: string[] // labs to offer, the ones on the chart first
  models: (lab: string, all: boolean) => Model[] // newest first
  value: (m: Model) => string | null
  isOn: (m: Model) => boolean
  isStar: (m: Model) => boolean
  toggle: (id: string) => void
  setMany: (ids: string[], on: boolean) => void
  star: (id: string) => void
  efforts: (m: Model) => Model[]
  picked: (m: Model) => string[]
  pickEffort: (id: string, e: string) => void
}

export function usePicker(
  data: Dataset,
  spec: ChartSpec,
  r: Resolved,
  onChange: (s: ChartSpec) => void,
): Picker {
  const labNames = useMemo(() => new Map(data.labs.map((l) => [l.id, l.name])), [data])
  const req = requiredMetrics(spec)
  const multi = spec.type === 'compare' || spec.type === 'table'
  const rankDef = data.metrics.find(
    (m) => m.id === (spec.filter.rankBy ?? (multi ? spec.metrics[0] : spec.y)),
  )
  const variants = useMemo(() => {
    const out = new Map<string, Model[]>()
    for (const m of data.models)
      if (m.family) (out.get(m.family) ?? out.set(m.family, []).get(m.family)!).push(m)
    return out
  }, [data])
  const byLab = useMemo(() => {
    const out = new Map<string, Model[]>()
    for (const m of r.candidates) (out.get(m.lab) ?? out.set(m.lab, []).get(m.lab)!).push(m)
    for (const list of out.values())
      list.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    return out
  }, [r])
  const onCount = (lab: string) => (byLab.get(lab) ?? []).filter((m) => r.shown.has(m.id)).length
  const labs = useMemo(() => {
    const picked = spec.filter.labs
    return [...byLab.keys()]
      .filter((l) => !picked.length || picked.includes(l))
      .sort((a, b) => {
        const ia = picked.indexOf(a)
        const ib = picked.indexOf(b)
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
        return onCount(b) - onCount(a) || byLab.get(b)!.length - byLab.get(a)!.length
      })
  }, [byLab, spec.filter.labs, r]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = spec.filter
  const setF = (patch: Partial<ChartSpec['filter']>) =>
    onChange({ ...spec, filter: { ...f, ...patch } })
  return {
    data,
    spec,
    r,
    rankDef,
    labName: (id) => labNames.get(id) ?? id,
    labs,
    models: (lab, all) =>
      (byLab.get(lab) ?? []).filter((m) => all || r.recommended.has(m.id) || r.shown.has(m.id)),
    value: (m) =>
      rankDef && m.values[rankDef.id] !== undefined
        ? formatValue(m.values[rankDef.id], rankDef.unit)
        : null,
    isOn: (m) => r.shown.has(m.id),
    isStar: (m) => spec.highlight.includes(m.id),
    toggle: (id) => {
      const on = r.shown.has(id)
      setF({
        include: on
          ? f.include.filter((x) => x !== id)
          : [...f.include.filter((x) => x !== id), id],
        exclude: on
          ? [...f.exclude.filter((x) => x !== id), id]
          : f.exclude.filter((x) => x !== id),
      })
    },
    setMany: (ids, on) =>
      setF({
        include: on
          ? [...new Set([...f.include, ...ids])]
          : f.include.filter((x) => !ids.includes(x)),
        exclude: on
          ? f.exclude.filter((x) => !ids.includes(x))
          : [...new Set([...f.exclude, ...ids])],
      }),
    star: (id) =>
      onChange({
        ...spec,
        highlight: spec.highlight.includes(id)
          ? spec.highlight.filter((h) => h !== id)
          : [...spec.highlight, id],
      }),
    efforts: (m) =>
      (variants.get(m.id) ?? [])
        .filter((v) => req.every((id) => v.values[id] !== undefined))
        .sort((a, b) => effortRank(a.effort) - effortRank(b.effort)),
    picked: (m) => spec.effortPick[m.id] ?? [],
    pickEffort: (id, e) => {
      const cur = spec.effortPick[id] ?? []
      const next = cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]
      const effortPick = { ...spec.effortPick }
      if (next.length) effortPick[id] = next
      else delete effortPick[id]
      onChange({ ...spec, effortPick })
    },
  }
}

// ---- shared pieces ------------------------------------------------------------

function Star({ on }: { on?: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={on ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    </svg>
  )
}

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<[T, string]>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${value === v ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-80 hover:border-white'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function EffortChips({ p, m }: { p: Picker; m: Model }) {
  const effs = p.efforts(m)
  if (effs.length < 2) return null
  const picked = p.picked(m)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {effs.map((v) => (
        <button
          key={v.id}
          onClick={() => p.pickEffort(m.id, v.effort!)}
          className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${picked.includes(v.effort!) ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-80 hover:border-white'}`}
        >
          {v.effort}
        </button>
      ))}
    </div>
  )
}

function LabHead({ p, lab, children }: { p: Picker; lab: string; children?: ReactNode }) {
  const all = p.models(lab, true)
  const on = all.filter(p.isOn).length
  return (
    <div className="flex items-center gap-2">
      <LabLogo lab={lab} name={p.labName(lab)} className="h-5 w-5" />
      <span className="truncate font-semibold lowercase">{p.labName(lab)}</span>
      <span className="text-xs text-white-50">
        {on}/{all.length}
      </span>
      <span className="ml-auto flex gap-3 text-xs text-white-50">{children}</span>
    </div>
  )
}

// ---- a. lines: one chip per version ----------------------------------------------

type Mode = 'show' | 'star' | 'effort'

// "Claude Opus 5.5" in the line "claude opus" is version "5.5"
function versionOf(m: Model): string {
  const words = new Set(seriesKey(m.name).split(' '))
  const rest = m.name
    .replace(/\([^)]*\)/g, ' ')
    .split(/[\s-]+/)
    .filter((w) => w && !words.has(w.toLowerCase().replace(/[^a-z]/g, '')))
  return rest.join(' ') || m.name
}

export function LinesPicker({ p }: { p: Picker }) {
  const [mode, setMode] = useState<Mode>('show')
  const [more, setMore] = useState<string[]>([])
  const [effortFor, setEffortFor] = useState<string | null>(null)
  const click = (m: Model) => {
    if (mode === 'show') p.toggle(m.id)
    else if (mode === 'star') {
      if (!p.isOn(m)) p.toggle(m.id)
      else p.star(m.id)
    } else setEffortFor(effortFor === m.id ? null : m.id)
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs text-white-50">
          {L('al pulsar una versión', 'when you click a version')}
        </p>
        <Seg
          value={mode}
          onChange={setMode}
          options={[
            ['show', L('mostrar u ocultar', 'show or hide')],
            ['star', L('destacar', 'highlight')],
            ['effort', L('elegir esfuerzos', 'pick efforts')],
          ]}
        />
      </div>
      {p.labs.map((lab) => {
        const all = p.models(lab, true)
        const lines = new Map<string, Model[]>()
        for (const m of all) {
          const k = seriesKey(m.name) || m.name.toLowerCase()
          ;(lines.get(k) ?? lines.set(k, []).get(k)!).push(m)
        }
        const expanded = more.includes(lab)
        const rows = [...lines.entries()].sort((a, b) =>
          (b[1][0].releaseDate ?? '').localeCompare(a[1][0].releaseDate ?? ''),
        )
        const live = rows.filter(([, ms]) => ms.some((m) => p.r.recommended.has(m.id) || p.isOn(m)))
        const list = expanded ? rows : live
        if (!list.length && !rows.length) return null
        return (
          <div key={lab} className="space-y-2">
            <LabHead p={p} lab={lab}>
              <button
                className="hover:text-white"
                onClick={() =>
                  p.setMany(
                    all.map((m) => m.id),
                    false,
                  )
                }
              >
                {L('ninguno', 'none')}
              </button>
            </LabHead>
            <div className="space-y-1.5">
              {list.map(([k, ms]) => (
                <div key={k}>
                  <div className="flex items-start gap-2">
                    <span className="w-24 shrink-0 truncate pt-1 text-xs text-white-50" title={k}>
                      {k}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {ms.slice(0, expanded ? 99 : 5).map((m) => {
                        const on = p.isOn(m)
                        const starred = p.isStar(m)
                        return (
                          <button
                            key={m.id}
                            onClick={() => click(m)}
                            title={`${m.name}${m.releaseDate ? `, ${m.releaseDate.slice(0, 7)}` : ''}${p.value(m) ? `, ${p.value(m)}` : ''}`}
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${on ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-50 hover:border-white hover:text-white'}`}
                          >
                            {starred && <Star on />}
                            {versionOf(m)}
                            {p.picked(m).length > 0 && (
                              <span className="opacity-60">{p.picked(m).length}e</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {ms.some((m) => m.id === effortFor) && (
                    <div className="mt-1.5 mb-1 ml-26 pl-0.5">
                      {p.efforts(ms.find((m) => m.id === effortFor)!).length > 1 ? (
                        <EffortChips p={p} m={ms.find((m) => m.id === effortFor)!} />
                      ) : (
                        <span className="text-xs text-white-50">
                          {L(
                            'este modelo solo tiene un nivel de esfuerzo en esta métrica.',
                            'this model has a single effort level on this metric.',
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {rows.length > live.length && (
              <button
                onClick={() => setMore(expanded ? more.filter((l) => l !== lab) : [...more, lab])}
                className="text-xs text-white-50 hover:text-white"
              >
                {expanded
                  ? L('solo líneas actuales', 'current lines only')
                  : `${L('ver líneas anteriores', 'show earlier lines')} (${rows.length - live.length})`}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

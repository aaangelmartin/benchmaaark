// three ways to pick models, side by side while we decide which one stays:
//   lines  each lab's lines (opus, sonnet...) with one chip per version
//   table  a full-screen sortable table
//   rail   lab logos down a rail, the models of one lab at a time
// they share one piece of logic (usePicker) and only differ in layout.
import { type ReactNode, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { type ChartSpec, requiredMetrics, type Resolved, seriesKey } from '../charts/spec.ts'
import { effortRank } from '../lib/effort.ts'
import { formatValue } from '../lib/format.ts'
import { getLang, L } from '../lib/lang.ts'
import type { Dataset, MetricDef, Model } from '../lib/types.ts'
import { LabLogo } from './LabLogo.tsx'
import { inputClass } from './ui.tsx'

export type PickerKind = 'lines' | 'table' | 'rail'

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

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? 'border-white bg-white' : 'border-white-50'}`}
    >
      {on && <span className="h-1.5 w-1.5 rounded-full bg-bg" />}
    </span>
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

// one model as a row: toggle, name, release, efforts, value, star
function ModelRow({ p, m, showLab }: { p: Picker; m: Model; showLab?: boolean }) {
  const [open, setOpen] = useState(false)
  const on = p.isOn(m)
  const starred = p.isStar(m)
  const effs = on ? p.efforts(m) : []
  const picked = p.picked(m)
  const val = p.value(m)
  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${on ? 'border-white-50' : 'border-transparent opacity-50 hover:opacity-80'}`}
      >
        <button
          onClick={() => p.toggle(m.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Dot on={on} />
          {showLab && <LabLogo lab={m.lab} name={p.labName(m.lab)} className="h-4 w-4" />}
          <span className={`truncate text-sm lowercase ${starred ? 'font-bold' : ''}`}>
            {m.name}
          </span>
          {m.releaseDate && (
            <span className="shrink-0 text-[0.65rem] text-white-50">
              {m.releaseDate.slice(0, 7)}
            </span>
          )}
        </button>
        {effs.length > 1 && (
          <button
            onClick={() => setOpen(!open)}
            title={L('elegir niveles de esfuerzo', 'pick effort levels')}
            className={`shrink-0 rounded-full px-1.5 text-[0.65rem] font-semibold ${picked.length ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-50 hover:text-white'}`}
          >
            {picked.length
              ? `${picked.length}/${effs.length}`
              : `${effs.length} ${L('esf.', 'eff.')}`}
          </button>
        )}
        {val && <span className="shrink-0 text-xs font-semibold text-white-80">{val}</span>}
        <button
          onClick={() => p.star(m.id)}
          title={starred ? L('quitar destacado', 'remove highlight') : L('destacar', 'highlight')}
          className={`shrink-0 ${starred ? 'text-white' : 'text-white-30 hover:text-white'}`}
        >
          <Star on={starred} />
        </button>
      </div>
      {effs.length > 1 && (open || picked.length > 0) && (
        <div className="mt-1 mb-2 ml-8">
          <EffortChips p={p} m={m} />
        </div>
      )}
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

// ---- b. table: full-screen, sortable --------------------------------------------

type Col = 'on' | 'name' | 'lab' | 'release' | 'value'

export function TablePicker({ p }: { p: Picker }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const [labs, setLabs] = useState<string[]>([])
  const [sort, setSort] = useState<{ col: Col; dir: 1 | -1 }>({ col: 'release', dir: -1 })
  const [effortFor, setEffortFor] = useState<string | null>(null)
  const on = p.labs.flatMap((l) => p.models(l, true)).filter(p.isOn)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const num = (m: Model) => (p.rankDef ? (m.values[p.rankDef.id] ?? -Infinity) : 0)
    const key: Record<Col, (m: Model) => string | number> = {
      on: (m) => Number(p.isOn(m)),
      name: (m) => m.name.toLowerCase(),
      lab: (m) => p.labName(m.lab).toLowerCase(),
      release: (m) => m.releaseDate ?? '',
      value: num,
    }
    return p.labs
      .filter((l) => !labs.length || labs.includes(l))
      .flatMap((l) => p.models(l, all || !!needle))
      .filter((m) => !needle || `${m.name} ${p.labName(m.lab)}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        const x = key[sort.col](a)
        const y = key[sort.col](b)
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
      })
  }, [p, q, all, labs, sort])

  const Th = ({ col, children, right }: { col: Col; children: ReactNode; right?: boolean }) => (
    <th className={`py-2 font-semibold ${right ? 'text-right' : 'text-left'}`}>
      <button
        className={`hover:text-white ${sort.col === col ? 'text-white' : ''}`}
        onClick={() =>
          setSort({
            col,
            dir:
              sort.col === col
                ? sort.dir === 1
                  ? -1
                  : 1
                : col === 'name' || col === 'lab'
                  ? 1
                  : -1,
          })
        }
      >
        {children}
        {sort.col === col ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-white-50 py-3 text-sm font-semibold hover:border-white"
      >
        {L('abrir la tabla de modelos', 'open the model table')}
      </button>
      <div className="flex flex-wrap gap-1.5">
        {on.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-white-30 px-2.5 py-1 text-xs lowercase"
          >
            {p.isStar(m) && <Star on />}
            {m.name}
            <button
              className="opacity-60 hover:opacity-100"
              onClick={() => p.toggle(m.id)}
              aria-label={L('quitar', 'remove')}
            >
              ×
            </button>
          </span>
        ))}
        {on.length === 0 && (
          <span className="text-sm text-white-50">
            {L('ningún modelo marcado.', 'no model picked.')}
          </span>
        )}
      </div>

      {/* on the page itself: inside the sidebar it would be clipped by it */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col bg-bg text-white">
            <div className="border-b border-white-20 px-4 py-3 md:px-8">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={L('buscar modelo o laboratorio', 'search model or lab')}
                  className={`${inputClass} !w-64`}
                />
                <Seg
                  value={all ? 'all' : 'rec'}
                  onChange={(v) => setAll(v === 'all')}
                  options={[
                    ['rec', L('últimos de cada línea', 'latest of each line')],
                    ['all', L('todos', 'all')],
                  ]}
                />
                <span className="text-sm text-white-50">
                  {on.length} {L('marcados', 'picked')}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="ml-auto rounded-full bg-solid px-5 py-2 text-sm font-semibold text-on-solid"
                >
                  {L('listo', 'done')}
                </button>
              </div>
              <div className="scrollbar-thin mx-auto mt-3 flex max-w-6xl gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setLabs([])}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${labs.length === 0 ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-80'}`}
                >
                  {L('todos los laboratorios', 'all labs')}
                </button>
                {p.labs.map((l) => (
                  <button
                    key={l}
                    onClick={() =>
                      setLabs(labs.includes(l) ? labs.filter((x) => x !== l) : [...labs, l])
                    }
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold lowercase ${labs.includes(l) ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-80 hover:border-white'}`}
                  >
                    <LabLogo lab={l} name={p.labName(l)} className="h-3.5 w-3.5" />
                    {p.labName(l)}
                  </button>
                ))}
              </div>
            </div>
            <div className="scrollbar-thin flex-1 overflow-y-auto px-4 md:px-8">
              <table className="mx-auto w-full max-w-6xl text-sm">
                <thead className="sticky top-0 bg-bg text-xs text-white-50">
                  <tr className="border-b border-white-50">
                    <Th col="on">{L('en la gráfica', 'on the chart')}</Th>
                    <Th col="name">{L('modelo', 'model')}</Th>
                    <Th col="lab">{L('laboratorio', 'lab')}</Th>
                    <Th col="release">{L('lanzamiento', 'release')}</Th>
                    <Th col="value" right>
                      {p.rankDef?.short[getLang()].toLowerCase() ?? L('valor', 'value')}
                    </Th>
                    <th className="py-2 pl-6 text-left font-semibold">
                      {L('esfuerzos', 'efforts')}
                    </th>
                    <th className="py-2 text-right font-semibold">{L('destacar', 'highlight')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white-10">
                  {rows.map((m) => {
                    const isOn = p.isOn(m)
                    const effs = p.efforts(m)
                    return (
                      <tr key={m.id} className={isOn ? '' : 'opacity-55 hover:opacity-90'}>
                        <td className="py-2">
                          <button
                            onClick={() => p.toggle(m.id)}
                            className="flex items-center"
                            aria-label={L('mostrar', 'show')}
                          >
                            <Dot on={isOn} />
                          </button>
                        </td>
                        <td>
                          <button
                            onClick={() => p.toggle(m.id)}
                            className={`text-left lowercase ${p.isStar(m) ? 'font-bold' : 'font-medium'}`}
                          >
                            {m.name}
                          </button>
                        </td>
                        <td>
                          <span className="flex items-center gap-2 text-white-80 lowercase">
                            <LabLogo lab={m.lab} name={p.labName(m.lab)} className="h-4 w-4" />
                            {p.labName(m.lab)}
                          </span>
                        </td>
                        <td className="text-white-80">{m.releaseDate?.slice(0, 7) ?? '-'}</td>
                        <td className="text-right font-semibold">{p.value(m) ?? '-'}</td>
                        <td className="pl-6">
                          {effs.length > 1 ? (
                            effortFor === m.id || p.picked(m).length ? (
                              <EffortChips p={p} m={m} />
                            ) : (
                              <button
                                className="text-xs text-white-50 underline hover:text-white"
                                onClick={() => setEffortFor(m.id)}
                              >
                                {effs.length} {L('niveles', 'levels')}
                              </button>
                            )
                          ) : (
                            <span className="text-xs text-white-30">-</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => p.star(m.id)}
                            className={
                              p.isStar(m) ? 'text-white' : 'text-white-30 hover:text-white'
                            }
                            aria-label={L('destacar', 'highlight')}
                          >
                            <Star on={p.isStar(m)} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="py-16 text-center text-white-50">
                  {L('nada coincide.', 'nothing matches.')}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

// ---- c. rail: one lab at a time ---------------------------------------------------

export function RailPicker({ p }: { p: Picker }) {
  const [lab, setLab] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const active = lab && p.labs.includes(lab) ? lab : p.labs[0]
  if (!active)
    return (
      <p className="text-sm text-white-50">
        {L('ningún modelo tiene estos datos.', 'no model has this data.')}
      </p>
    )
  const list = p.models(active, all)
  const total = p.models(active, true)
  return (
    <div className="flex gap-3">
      <div className="scrollbar-thin flex max-h-[30rem] w-14 shrink-0 flex-col gap-1.5 overflow-y-auto pr-1">
        {p.labs.map((l) => {
          const n = p.models(l, true).filter(p.isOn).length
          return (
            <button
              key={l}
              onClick={() => setLab(l)}
              title={p.labName(l)}
              className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border transition-colors ${l === active ? 'border-solid-line bg-solid text-on-solid' : n ? 'border-white-30 hover:border-white' : 'border-white-10 opacity-50 hover:opacity-90'}`}
            >
              <LabLogo lab={l} name={p.labName(l)} className="h-5 w-5" />
              {n > 0 && (
                <span
                  className={`absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.6rem] font-bold ${l === active ? 'bg-bg text-white' : 'bg-white text-bg'}`}
                >
                  {n}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <LabHead p={p} lab={active}>
          <button
            className="hover:text-white"
            onClick={() =>
              p.setMany(
                list.map((m) => m.id),
                true,
              )
            }
          >
            {L('todos', 'all')}
          </button>
          <button
            className="hover:text-white"
            onClick={() =>
              p.setMany(
                total.map((m) => m.id),
                false,
              )
            }
          >
            {L('ninguno', 'none')}
          </button>
        </LabHead>
        <div className="space-y-1">
          {list.map((m) => (
            <ModelRow key={m.id} p={p} m={m} />
          ))}
        </div>
        {total.length > list.length || all ? (
          <button onClick={() => setAll(!all)} className="text-xs text-white-50 hover:text-white">
            {all
              ? L('solo los últimos de cada línea', 'only the latest of each line')
              : L(
                  `ver los ${total.length} modelos de ${p.labName(active).toLowerCase()}`,
                  `show all ${total.length} models from ${p.labName(active).toLowerCase()}`,
                )}
          </button>
        ) : null}
      </div>
    </div>
  )
}

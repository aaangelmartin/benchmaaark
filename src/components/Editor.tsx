// the chart editor, as four steps you open one at a time:
//   1. qué gráfica   type and metrics
//   2. laboratorios  which labs, by logo
//   3. modelos       which models of each lab, their efforts, and highlights
//   4. aspecto       format, language, text and style
// everything is picked by clicking, nothing needs typing except the title.
import { type ReactNode, useMemo, useState } from 'react'
import { Marker } from '../charts/primitives.tsx'
import {
  type ChartSpec,
  type ChartType,
  FORMATS,
  type FormatId,
  requiredMetrics,
  resolve,
} from '../charts/spec.ts'
import type { Shape } from '../charts/theme.ts'
import { effortRank } from '../lib/effort.ts'
import { formatValue } from '../lib/format.ts'
import type { Dataset, MetricCategory, MetricDef, Model } from '../lib/types.ts'
import { LabLogo } from './LabLogo.tsx'
import { Field, inputClass, Pills, Toggle } from './ui.tsx'

const CATEGORIES: Array<[MetricCategory, string]> = [
  ['intelligence', 'inteligencia'],
  ['benchmark', 'benchmarks'],
  ['arena', 'arena'],
  ['cost', 'coste'],
  ['speed', 'velocidad'],
  ['context', 'contexto'],
]

const TYPES: Array<{ value: ChartType; label: string; hint: string }> = [
  { value: 'scatter', label: 'dispersión', hint: 'dos métricas cruzadas' },
  { value: 'bars', label: 'ranking', hint: 'quién va primero' },
  { value: 'timeline', label: 'evolución', hint: 'cómo avanza en el tiempo' },
  { value: 'compare', label: 'comparativa', hint: 'pocos modelos, muchas métricas' },
  { value: 'table', label: 'tabla', hint: 'resumen con números' },
]

type Step = 1 | 2 | 3 | 4

export function Editor({
  data,
  spec,
  onChange,
  exportPanel,
}: {
  data: Dataset
  spec: ChartSpec
  onChange: (s: ChartSpec) => void
  exportPanel: ReactNode
}) {
  const [open, setOpen] = useState<Step | null>(3)
  const r = useMemo(() => resolve(data, spec), [data, spec])
  const metricById = useMemo(() => new Map(data.metrics.map((m) => [m.id, m])), [data])
  const labName = useMemo(() => new Map(data.labs.map((l) => [l.id, l.name])), [data])
  const set = (patch: Partial<ChartSpec>) => onChange({ ...spec, ...patch })
  const setF = (patch: Partial<ChartSpec['filter']>) =>
    onChange({ ...spec, filter: { ...spec.filter, ...patch } })
  const setO = (patch: Partial<ChartSpec['options']>) =>
    onChange({ ...spec, options: { ...spec.options, ...patch } })
  const L = spec.locale
  const short = (id: string) => metricById.get(id)?.short.es ?? id

  const metricSummary =
    spec.type === 'scatter'
      ? `${short(spec.y)} frente a ${short(spec.x)}`
      : spec.type === 'compare' || spec.type === 'table'
        ? spec.metrics.map(short).join(', ')
        : short(spec.y)
  const labSummary = spec.filter.labs.length
    ? spec.filter.labs.map((l) => labName.get(l) ?? l).join(', ')
    : 'todos'

  return (
    <div className="pb-24">
      <div className="sticky top-0 z-10 border-b border-white-20 bg-bg px-5 py-4">
        {exportPanel}
      </div>

      <StepBox
        n={1}
        title="qué gráfica"
        summary={`${TYPES.find((t) => t.value === spec.type)?.label}: ${metricSummary}`}
        open={open === 1}
        onToggle={() => setOpen(open === 1 ? null : 1)}
        onNext={() => setOpen(2)}
      >
        <div className="grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => set({ type: t.value })}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${spec.type === t.value ? 'border-white bg-white text-bg' : 'border-white-30 hover:border-white'}`}
            >
              <TypeIcon type={t.value} />
              <span>
                <span className="block text-sm font-semibold">{t.label}</span>
                <span
                  className={`block text-xs ${spec.type === t.value ? 'opacity-70' : 'text-white-50'}`}
                >
                  {t.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
        <MetricChooser data={data} spec={spec} onChange={onChange} />
      </StepBox>

      <StepBox
        n={2}
        title="laboratorios"
        summary={labSummary}
        open={open === 2}
        onToggle={() => setOpen(open === 2 ? null : 2)}
        onNext={() => setOpen(3)}
      >
        <LabsStep data={data} spec={spec} r={r} onChange={(labs) => setF({ labs })} />
      </StepBox>

      <StepBox
        n={3}
        title="modelos"
        summary={`${r.shown.size} en la gráfica${spec.highlight.length ? `, ${spec.highlight.length} destacados` : ''}`}
        open={open === 3}
        onToggle={() => setOpen(open === 3 ? null : 3)}
        onNext={() => setOpen(4)}
      >
        <ModelsStep data={data} spec={spec} r={r} onChange={onChange} setF={setF} setO={setO} />
      </StepBox>

      <StepBox
        n={4}
        title="aspecto"
        summary={`${FORMATS[spec.format].label}, ${spec.locale}`}
        open={open === 4}
        onToggle={() => setOpen(open === 4 ? null : 4)}
      >
        <Field label="formato">
          <div className="grid grid-cols-5 gap-2">
            {(Object.keys(FORMATS) as FormatId[]).map((f) => {
              const { w, h, label, hint } = FORMATS[f]
              const on = spec.format === f
              return (
                <button
                  key={f}
                  onClick={() => set({ format: f })}
                  title={hint}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <span className="grid h-12 w-full place-items-center">
                    <span
                      className={`block rounded-[3px] border-2 transition-colors ${on ? 'border-white bg-white' : 'border-white-50 group-hover:border-white'}`}
                      style={{
                        width: w > h ? 40 : (40 * w) / h,
                        height: w > h ? (40 * h) / w : 40,
                      }}
                    />
                  </span>
                  <span
                    className={`text-[0.65rem] leading-tight ${on ? 'font-semibold' : 'text-white-50'}`}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="mt-1 text-xs text-white-50">{FORMATS[spec.format].hint}</p>
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-sm text-white-80">idioma</span>
          <Pills
            value={spec.locale}
            options={[
              { value: 'es', label: 'español' },
              { value: 'en', label: 'english' },
            ]}
            onChange={(v) => set({ locale: v })}
          />
        </div>
        <Field label="título">
          <input
            className={inputClass}
            value={spec.title?.[L] ?? ''}
            placeholder="automático"
            onChange={(e) => setText(spec, onChange, 'title', e.target.value)}
          />
        </Field>
        <Field label="subtítulo">
          <textarea
            className={`${inputClass} min-h-16 resize-y`}
            value={spec.subtitle?.[L] ?? ''}
            placeholder="opcional"
            onChange={(e) => setText(spec, onChange, 'subtitle', e.target.value)}
          />
        </Field>

        {(spec.type === 'scatter' || spec.type === 'timeline') && (
          <>
            <Field label="forma de los puntos">
              <Pills
                value={spec.options.series}
                options={[
                  { value: 'lab', label: 'una por laboratorio' },
                  { value: 'weights', label: 'abiertos / cerrados' },
                  { value: 'none', label: 'todas iguales' },
                ]}
                onChange={(v) => setO({ series: v })}
              />
            </Field>
            <Field label="etiquetas">
              <Pills
                value={spec.options.labels}
                options={[
                  { value: 'auto', label: 'las que caben' },
                  { value: 'all', label: 'todas' },
                  { value: 'highlight', label: 'solo destacados' },
                  { value: 'none', label: 'ninguna' },
                ]}
                onChange={(v) => setO({ labels: v })}
              />
            </Field>
            <Toggle
              label={spec.type === 'scatter' ? 'línea de frontera de pareto' : 'línea de récords'}
              checked={spec.options.frontier}
              onChange={(v) => setO({ frontier: v })}
            />
          </>
        )}
        {spec.type !== 'compare' && spec.type !== 'table' && (
          <Field label="opacidad">
            <Pills
              value={spec.options.color}
              options={[
                { value: 'model', label: 'una por modelo' },
                { value: 'lab', label: 'una por laboratorio' },
                { value: 'none', label: 'sin variar' },
              ]}
              onChange={(v) => setO({ color: v })}
            />
          </Field>
        )}
        {spec.type === 'scatter' && (
          <Toggle
            label="eje x en escala logarítmica"
            checked={spec.options.logX}
            onChange={(v) => setO({ logX: v })}
          />
        )}
        {(spec.type === 'scatter' || spec.type === 'timeline') && (
          <Toggle
            label="eje y en escala logarítmica"
            checked={spec.options.logY}
            onChange={(v) => setO({ logY: v })}
          />
        )}
        {spec.type === 'bars' && (
          <Field label="orden">
            <Pills
              value={spec.options.sort}
              options={[
                { value: 'best', label: 'mejor arriba' },
                { value: 'worst', label: 'peor arriba' },
              ]}
              onChange={(v) => setO({ sort: v })}
            />
          </Field>
        )}
        {(spec.type === 'bars' || spec.type === 'table') && (
          <Toggle
            label="nombre del laboratorio bajo cada modelo"
            checked={spec.options.showLab}
            onChange={(v) => setO({ showLab: v })}
          />
        )}
        <Toggle
          label="todo en minúsculas (marca)"
          checked={spec.options.lowercase}
          onChange={(v) => setO({ lowercase: v })}
        />
      </StepBox>
    </div>
  )
}

function setText(
  spec: ChartSpec,
  onChange: (s: ChartSpec) => void,
  k: 'title' | 'subtitle',
  v: string,
) {
  const cur = spec[k] ?? { es: '', en: '' }
  const next = { ...cur, [spec.locale]: v }
  onChange({ ...spec, [k]: next.es || next.en ? next : null })
}

function StepBox({
  n,
  title,
  summary,
  open,
  onToggle,
  onNext,
  children,
}: {
  n: number
  title: string
  summary: string
  open: boolean
  onToggle: () => void
  onNext?: () => void
  children: ReactNode
}) {
  return (
    <section className="border-b border-white-20">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${open ? 'bg-white text-bg' : 'border border-white-50'}`}
        >
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          {!open && (
            <span className="block truncate text-xs text-white-50 lowercase">{summary}</span>
          )}
        </span>
        <span
          className={`text-white-50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 5l4 4 4-4" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="space-y-4 px-5 pb-5">
          {children}
          {onNext && (
            <button
              onClick={onNext}
              className="w-full rounded-full border border-white-30 py-2 text-sm font-semibold text-white-80 hover:border-white hover:text-white"
            >
              siguiente
            </button>
          )}
        </div>
      )}
    </section>
  )
}

// ---- 1. metrics -------------------------------------------------------------

function MetricChooser({
  data,
  spec,
  onChange,
}: {
  data: Dataset
  spec: ChartSpec
  onChange: (s: ChartSpec) => void
}) {
  const multi = spec.type === 'compare' || spec.type === 'table'
  const [slot, setSlot] = useState<'y' | 'x'>('y')
  const active = multi ? null : spec.type === 'scatter' ? spec[slot] : spec.y
  const firstCat =
    data.metrics.find((m) => m.id === (active ?? spec.metrics[0]))?.category ?? 'intelligence'
  const [cat, setCat] = useState<MetricCategory>(firstCat)
  const [more, setMore] = useState(false)
  // list prices per token say nothing about what a run costs, so they are never
  // offered: cost is always the cost per task of a benchmark
  const usable = data.metrics.filter((m) => m.unit !== 'usd_per_mtok')
  const list = usable
    .filter((m) => m.category === cat)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  const shown = more ? list : list.slice(0, 12)
  const byId = new Map(data.metrics.map((m) => [m.id, m]))

  const pick = (m: MetricDef) => {
    if (multi) {
      const has = spec.metrics.includes(m.id)
      onChange({
        ...spec,
        metrics: has ? spec.metrics.filter((x) => x !== m.id) : [...spec.metrics, m.id],
      })
    } else if (spec.type === 'scatter') {
      // a benchmark with a cost per task brings its cost to the other axis
      const cost = slot === 'y' ? byId.get(`${m.id}-cost`) : undefined
      if (cost) {
        onChange({
          ...spec,
          y: m.id,
          x: cost.id,
          options: { ...spec.options, logX: true, logY: false },
        })
        return
      }
      onChange({
        ...spec,
        [slot]: m.id,
        options: { ...spec.options, ...(slot === 'x' ? { logX: !!m.log } : { logY: false }) },
      })
      if (slot === 'y') setSlot('x')
    } else
      onChange({
        ...spec,
        y: m.id,
        options: { ...spec.options, logY: spec.type === 'timeline' && !!m.log },
      })
  }
  const isOn = (m: MetricDef) => (multi ? spec.metrics.includes(m.id) : active === m.id)

  return (
    <div className="space-y-3">
      {spec.type === 'scatter' && (
        <div className="grid grid-cols-2 gap-2">
          {(['y', 'x'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSlot(k)}
              className={`rounded-xl border p-2.5 text-left ${slot === k ? 'border-white' : 'border-white-20'}`}
            >
              <span className="block text-[0.65rem] tracking-widest text-white-50">
                {k === 'y' ? 'eje vertical' : 'eje horizontal'}
              </span>
              <span className="block truncate text-sm font-semibold lowercase">
                {byId.get(spec[k])?.short.es ?? spec[k]}
              </span>
            </button>
          ))}
        </div>
      )}
      {multi && (
        <p className="text-xs text-white-50">
          marca las métricas en el orden en que quieres verlas. elegidas:{' '}
          <span className="text-white-80 lowercase">
            {spec.metrics.map((id) => byId.get(id)?.short.es ?? id).join(', ') || 'ninguna'}
          </span>
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.filter(([c]) => usable.some((m) => m.category === c)).map(([c, label]) => (
          <button
            key={c}
            onClick={() => {
              setCat(c)
              setMore(false)
            }}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${cat === c ? 'bg-white text-bg' : 'text-white-50 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {shown.map((m) => (
          <button
            key={m.id}
            onClick={() => pick(m)}
            title={m.label.es + (m.description ? `. ${m.description.es}` : '')}
            className={`flex items-baseline justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${isOn(m) ? 'border-white bg-white text-bg' : 'border-white-20 hover:border-white-50'}`}
          >
            <span className="truncate font-semibold lowercase">{m.short.es}</span>
            <span className={isOn(m) ? 'opacity-60' : 'text-white-50'}>{m.count}</span>
          </button>
        ))}
      </div>
      {list.length > 12 && (
        <button onClick={() => setMore(!more)} className="text-xs text-white-50 hover:text-white">
          {more ? 'ver menos' : `ver las ${list.length} de esta categoría`}
        </button>
      )}
      <p className="text-xs text-white-50">el número es cuántos modelos tienen ese dato.</p>
    </div>
  )
}

// ---- 2. labs ----------------------------------------------------------------

function LabsStep({
  data,
  spec,
  r,
  onChange,
}: {
  data: Dataset
  spec: ChartSpec
  r: ReturnType<typeof resolve>
  onChange: (labs: string[]) => void
}) {
  const [all, setAll] = useState(false)
  const counts = new Map<string, number>()
  for (const m of r.candidates) counts.set(m.lab, (counts.get(m.lab) ?? 0) + 1)
  const labs = data.labs
    .filter((l) => l.id !== 'other' && (counts.get(l.id) ?? 0) > 0)
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  const shown = all ? labs : labs.slice(0, 15)
  const sel = spec.filter.labs
  const toggle = (id: string) =>
    onChange(sel.includes(id) ? sel.filter((l) => l !== id) : [...sel, id])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Pill on={sel.length === 0} onClick={() => onChange([])}>
          todos
        </Pill>
        <Pill
          on={false}
          onClick={() =>
            onChange(
              ['openai', 'anthropic', 'google', 'xai', 'deepseek'].filter((l) => counts.has(l)),
            )
          }
        >
          los 5 grandes
        </Pill>
        <Pill
          on={false}
          onClick={() =>
            onChange(
              ['deepseek', 'alibaba', 'moonshot', 'zai', 'minimax'].filter((l) => counts.has(l)),
            )
          }
        >
          china
        </Pill>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {shown.map((l) => {
          const on = sel.includes(l.id)
          return (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors ${on ? 'border-white bg-white text-bg' : 'border-white-20 hover:border-white-50'}`}
            >
              {on && spec.options.series === 'lab' && (
                <span className="absolute top-1.5 right-1.5">
                  <ShapeIcon shape={r.shapeOf(l.id)} dark />
                </span>
              )}
              <LabLogo lab={l.id} name={l.name} className="h-6 w-6" />
              <span className="w-full truncate text-center text-xs font-semibold lowercase">
                {l.name}
              </span>
              <span className={`text-[0.65rem] ${on ? 'opacity-60' : 'text-white-50'}`}>
                {counts.get(l.id)} modelos
              </span>
            </button>
          )
        })}
      </div>
      {labs.length > 15 && (
        <button onClick={() => setAll(!all)} className="text-xs text-white-50 hover:text-white">
          {all ? 'ver menos' : `ver los ${labs.length} laboratorios`}
        </button>
      )}
      <p className="text-xs text-white-50">
        sin ninguno marcado entran todos. en la gráfica, cada laboratorio tiene su forma.
      </p>
    </div>
  )
}

// ---- 3. models --------------------------------------------------------------

function ModelsStep({
  data,
  spec,
  r,
  onChange,
  setF,
  setO,
}: {
  data: Dataset
  spec: ChartSpec
  r: ReturnType<typeof resolve>
  onChange: (s: ChartSpec) => void
  setF: (p: Partial<ChartSpec['filter']>) => void
  setO: (p: Partial<ChartSpec['options']>) => void
}) {
  const labName = new Map(data.labs.map((l) => [l.id, l.name]))
  const req = requiredMetrics(spec)
  const rankId =
    spec.filter.rankBy ??
    (spec.type === 'compare' || spec.type === 'table' ? spec.metrics[0] : spec.y)
  const rankDef = data.metrics.find((m) => m.id === rankId)
  const candidateIds = new Set(r.candidates.map((m) => m.id))

  // labs to list: the picked ones, else the ones on the chart
  const labs = spec.filter.labs.length ? spec.filter.labs : r.labsShown
  const variants = useMemo(() => {
    const out = new Map<string, Model[]>()
    for (const m of data.models)
      if (m.family) (out.get(m.family) ?? out.set(m.family, []).get(m.family)!).push(m)
    return out
  }, [data])
  const hasData = (m: Model) => req.every((id) => m.values[id] !== undefined)

  const f = spec.filter
  const toggle = (id: string) => {
    const on = r.shown.has(id)
    setF({
      include: on ? f.include.filter((x) => x !== id) : [...f.include.filter((x) => x !== id), id],
      exclude: on ? [...f.exclude.filter((x) => x !== id), id] : f.exclude.filter((x) => x !== id),
    })
  }
  const setLab = (lab: string, on: boolean) => {
    const ids = r.candidates.filter((m) => m.lab === lab).map((m) => m.id)
    setF({
      include: on
        ? [...new Set([...f.include, ...ids])]
        : f.include.filter((x) => !ids.includes(x)),
      exclude: on
        ? f.exclude.filter((x) => !ids.includes(x))
        : [...new Set([...f.exclude, ...ids])],
    })
  }
  const star = (id: string) =>
    onChange({
      ...spec,
      highlight: spec.highlight.includes(id)
        ? spec.highlight.filter((h) => h !== id)
        : [...spec.highlight, id],
    })
  const pickEffort = (id: string, e: string) => {
    const cur = spec.effortPick[id] ?? []
    const next = cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]
    const effortPick = { ...spec.effortPick }
    if (next.length) effortPick[id] = next
    else delete effortPick[id]
    onChange({ ...spec, effortPick })
  }
  const anyEfforts = data.models.some((m) => m.family && hasData(m))
  const touched = f.include.length + f.exclude.length
  const maxTop = spec.type === 'scatter' || spec.type === 'timeline' ? 120 : 30

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-white-20 p-3">
        <p className="text-xs text-white-80">
          <span className="font-semibold text-white">selección automática:</span> los {f.top}{' '}
          mejores
          {rankDef ? ` en ${rankDef.short.es.toLowerCase()}` : ''}
          {f.sinceMonths ? ` de los últimos ${f.sinceMonths} meses` : ''}. después enciende o apaga
          los que quieras abajo.
        </p>
        <input
          type="range"
          min={2}
          max={maxTop}
          value={Math.min(f.top, maxTop)}
          onChange={(e) => setF({ top: Number(e.target.value) })}
          className="w-full"
        />
        <Pills
          value={f.sinceMonths ?? 0}
          options={[
            { value: 6, label: '6 meses' },
            { value: 12, label: '1 año' },
            { value: 24, label: '2 años' },
            { value: 0, label: 'siempre' },
          ]}
          onChange={(v) => setF({ sinceMonths: v || null })}
        />
        <Pills
          value={f.weights}
          options={[
            { value: 'all', label: 'abiertos y cerrados' },
            { value: 'open', label: 'solo abiertos' },
            { value: 'closed', label: 'solo cerrados' },
          ]}
          onChange={(v) => setF({ weights: v })}
        />
        {(spec.type === 'scatter' || spec.type === 'bars' || spec.type === 'timeline') &&
          (anyEfforts ? (
            <Toggle
              label="todos los esfuerzos de cada modelo, unidos"
              checked={spec.options.efforts === 'all'}
              onChange={(v) => setO({ efforts: v ? 'all' : 'best' })}
            />
          ) : (
            <p className="text-xs text-white-50">
              estas métricas no distinguen niveles de esfuerzo (el eci, por ejemplo, se calcula una
              vez por modelo). para ver esfuerzos usa el índice de artificial analysis o un
              benchmark de epoch.
            </p>
          ))}
        {spec.type === 'scatter' &&
          spec.options.efforts === 'all' &&
          data.metrics.find((m) => m.id === spec.x)?.unit === 'usd_per_mtok' && (
            <p className="rounded-lg border border-white-30 p-2 text-xs text-white-80">
              ojo: el precio por token es el mismo en todos los esfuerzos, así que salen en
              vertical. para ver cuánto cuesta pensar más, pon en el eje horizontal un coste por
              tarea (coste cursorbench, coste arc-agi-2...).
            </p>
          )}
        {touched > 0 && (
          <button
            className="text-xs text-white-50 underline hover:text-white"
            onClick={() => setF({ include: [], exclude: [] })}
          >
            deshacer mis {touched} cambios a mano
          </button>
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-white-50">
        <StarIcon on /> destaca un modelo: se ve en blanco puro y el resto se apaga.
      </p>

      {labs.length === 0 && (
        <p className="text-sm text-white-50">no hay modelos con datos para esta gráfica.</p>
      )}
      {labs.map((lab) => (
        <LabGroup
          key={lab}
          lab={lab}
          name={labName.get(lab) ?? lab}
          shape={
            spec.options.series === 'lab' && (spec.type === 'scatter' || spec.type === 'timeline')
              ? r.shapeOf(lab)
              : null
          }
          models={data.models.filter((m) => !m.family && m.lab === lab)}
          isCandidate={(m) => candidateIds.has(m.id)}
          isShown={(m) => r.shown.has(m.id)}
          isStarred={(m) => spec.highlight.includes(m.id)}
          value={(m) =>
            rankDef && m.values[rankDef.id] !== undefined
              ? formatValue(m.values[rankDef.id], rankDef.unit)
              : null
          }
          rank={(m) =>
            rankDef && m.values[rankDef.id] !== undefined
              ? rankDef.higherIsBetter
                ? -m.values[rankDef.id]
                : m.values[rankDef.id]
              : Infinity
          }
          missing={req
            .map((id) => data.metrics.find((d) => d.id === id)?.short.es ?? id)
            .join(' y ')}
          efforts={(m) =>
            (variants.get(m.id) ?? [])
              .filter(hasData)
              .sort((a, b) => effortRank(a.effort) - effortRank(b.effort))
          }
          picked={(m) => spec.effortPick[m.id] ?? []}
          onToggle={toggle}
          onStar={star}
          onEffort={pickEffort}
          onAll={(on) => setLab(lab, on)}
          tone={spec.options.color === 'model' ? (m) => r.tone(m) : null}
        />
      ))}
    </div>
  )
}

function LabGroup(p: {
  lab: string
  name: string
  shape: Shape | null
  models: Model[]
  isCandidate: (m: Model) => boolean
  isShown: (m: Model) => boolean
  isStarred: (m: Model) => boolean
  value: (m: Model) => string | null
  rank: (m: Model) => number
  missing: string
  efforts: (m: Model) => Model[]
  picked: (m: Model) => string[]
  onToggle: (id: string) => void
  onStar: (id: string) => void
  onEffort: (id: string, e: string) => void
  onAll: (on: boolean) => void
  tone: ((m: Model) => number) | null
}) {
  const [more, setMore] = useState(false)
  const [noData, setNoData] = useState(false)
  const [openEfforts, setOpenEfforts] = useState<string[]>([])
  const withData = p.models.filter(p.isCandidate).sort((a, b) => p.rank(a) - p.rank(b))
  const recent = new Date()
  recent.setUTCMonth(recent.getUTCMonth() - 18)
  const without = p.models
    .filter((m) => !p.isCandidate(m) && (m.releaseDate ?? '') >= recent.toISOString().slice(0, 10))
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
  // shown models first, so what is on the chart is never hidden behind "ver más"
  const ordered = [...withData.filter(p.isShown), ...withData.filter((m) => !p.isShown(m))]
  const list = more ? ordered : ordered.slice(0, Math.max(10, withData.filter(p.isShown).length))
  const shownCount = withData.filter(p.isShown).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <LabLogo lab={p.lab} name={p.name} className="h-5 w-5" />
        <span className="font-semibold lowercase">{p.name}</span>
        {p.shape && <ShapeIcon shape={p.shape} />}
        <span className="text-xs text-white-50">
          {shownCount}/{withData.length}
        </span>
        <span className="ml-auto flex gap-3 text-xs text-white-50">
          <button className="hover:text-white" onClick={() => p.onAll(true)}>
            todos
          </button>
          <button className="hover:text-white" onClick={() => p.onAll(false)}>
            ninguno
          </button>
        </span>
      </div>
      <div className="space-y-1">
        {list.map((m) => {
          const on = p.isShown(m)
          const starred = p.isStarred(m)
          const effs = on ? p.efforts(m) : []
          const val = p.value(m)
          return (
            <div key={m.id}>
              <div
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${on ? 'border-white-50' : 'border-transparent opacity-50 hover:opacity-80'}`}
              >
                <button
                  onClick={() => p.onToggle(m.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <span
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${on ? 'border-white bg-white' : 'border-white-50'}`}
                  >
                    {on && <span className="h-1.5 w-1.5 rounded-full bg-bg" />}
                  </span>
                  {on && p.tone && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-white"
                      style={{ opacity: p.tone(m) }}
                      title="opacidad en la gráfica"
                    />
                  )}
                  <span className={`truncate text-sm lowercase ${starred ? 'font-bold' : ''}`}>
                    {m.name}
                  </span>
                </button>
                {effs.length > 1 && (
                  <button
                    onClick={() =>
                      setOpenEfforts(
                        openEfforts.includes(m.id)
                          ? openEfforts.filter((x) => x !== m.id)
                          : [...openEfforts, m.id],
                      )
                    }
                    title="elegir niveles de esfuerzo"
                    className={`shrink-0 rounded-full px-1.5 text-[0.65rem] font-semibold ${p.picked(m).length ? 'bg-white text-bg' : 'border border-white-30 text-white-50 hover:text-white'}`}
                  >
                    {p.picked(m).length
                      ? `${p.picked(m).length}/${effs.length}`
                      : `${effs.length} esf.`}
                  </button>
                )}
                {val && <span className="shrink-0 text-xs font-semibold text-white-80">{val}</span>}
                <button
                  onClick={() => p.onStar(m.id)}
                  title={starred ? 'quitar destacado' : 'destacar'}
                  className={`shrink-0 ${starred ? 'text-white' : 'text-white-30 hover:text-white'}`}
                >
                  <StarIcon on={starred} />
                </button>
              </div>
              {effs.length > 1 && (openEfforts.includes(m.id) || p.picked(m).length > 0) && (
                <div className="mt-1 mb-2 ml-8 flex flex-wrap items-center gap-1">
                  <span className="mr-1 text-[0.65rem] text-white-50">esfuerzo</span>
                  {effs.map((v) => {
                    const sel = p.picked(m).includes(v.effort!)
                    return (
                      <button
                        key={v.id}
                        onClick={() => p.onEffort(m.id, v.effort!)}
                        className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${sel ? 'bg-white text-bg' : 'border border-white-30 text-white-80 hover:border-white'}`}
                      >
                        {v.effort}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {ordered.length > list.length || more ? (
        <button onClick={() => setMore(!more)} className="text-xs text-white-50 hover:text-white">
          {more ? 'ver menos' : `ver los ${withData.length} modelos`}
        </button>
      ) : null}
      {without.length > 0 && (
        <div>
          <button
            onClick={() => setNoData(!noData)}
            className="text-xs text-white-50 hover:text-white"
          >
            {noData
              ? 'ocultar'
              : `${without.length} recientes sin datos de ${p.missing || 'esta métrica'}`}
          </button>
          {noData && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {without.map((m) => (
                <span
                  key={m.id}
                  title={`todavía nadie ha publicado ${p.missing} para este modelo`}
                  className="rounded-full border border-dashed border-white-30 px-2.5 py-0.5 text-xs text-white-50 lowercase"
                >
                  {m.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- small pieces -----------------------------------------------------------

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${on ? 'bg-white text-bg' : 'border border-white-30 text-white-80 hover:border-white'}`}
    >
      {children}
    </button>
  )
}

// the lab's marker as it appears on the chart. on a white tile it sits on a
// small cyan disc so it stays white, like on the poster
function ShapeIcon({ shape, dark }: { shape: Shape; dark?: boolean }) {
  return (
    <span
      className={`grid place-items-center rounded-full ${dark ? 'h-5 w-5 bg-bg' : ''}`}
      title="forma en la gráfica"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <Marker shape={shape} x={7} y={7} r={4.5} />
      </svg>
    </span>
  )
}

function StarIcon({ on }: { on?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
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

function TypeIcon({ type }: { type: ChartType }) {
  const c = 'currentColor'
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke={c}
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0"
    >
      {type === 'scatter' && (
        <>
          <circle cx="7" cy="19" r="2" fill={c} stroke="none" />
          <circle cx="12" cy="13" r="2" fill={c} stroke="none" />
          <circle cx="18" cy="15" r="2" fill={c} stroke="none" />
          <circle cx="21" cy="7" r="2" fill={c} stroke="none" />
        </>
      )}
      {type === 'bars' && <path d="M5 7h18M5 12h14M5 17h10M5 22h6" />}
      {type === 'timeline' && <path d="M4 22h5v-5h5v-4h5V7h5" />}
      {type === 'compare' && (
        <path d="M4 8h8M4 12h5M16 8h8M16 12h6M4 19h7M4 23h4M16 19h4M16 23h8" />
      )}
      {type === 'table' && <path d="M4 7h20M4 12h20M4 17h20M4 22h20M11 7v15" strokeWidth="1.5" />}
    </svg>
  )
}

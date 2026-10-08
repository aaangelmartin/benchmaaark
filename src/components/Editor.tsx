// the chart editor, four steps opened one at a time:
//   1. gráfica y fuente   what kind of chart, from which source, which metric
//   2. laboratorios       every lab, by logo
//   3. modelos            plain lists grouped by lab: toggle, star, efforts
//   4. aspecto            format, language, text and style
import { type ReactNode, useMemo, useState } from 'react'
import { SOURCE_ORDER } from '../charts/catalogue.ts'
import { Marker } from '../charts/primitives.tsx'
import {
  type ChartSpec,
  type ChartType,
  FORMATS,
  type FormatId,
  requiredMetrics,
  type Resolved,
  resolve,
} from '../charts/spec.ts'
import type { Shape } from '../charts/theme.ts'
import { effortRank } from '../lib/effort.ts'
import { formatValue } from '../lib/format.ts'
import type { Dataset, MetricDef, Model, SourceId } from '../lib/types.ts'
import { LabLogo } from './LabLogo.tsx'
import { Field, inputClass, Pills, Toggle } from './ui.tsx'

const CYAN = '#00b5e2'

const TYPES: Array<{ value: ChartType; label: string; hint: string }> = [
  { value: 'bars', label: 'ranking', hint: 'quién va primero' },
  { value: 'scatter', label: 'dispersión', hint: 'dos métricas cruzadas' },
  { value: 'timeline', label: 'evolución', hint: 'cómo avanza en el tiempo' },
  { value: 'table', label: 'tabla', hint: 'resumen con números' },
  { value: 'compare', label: 'comparativa', hint: 'pocos modelos, varias métricas' },
]

export type Step = 1 | 2 | 3 | 4

export function Editor({
  data,
  spec,
  onChange,
  exportPanel,
  step,
  onStep,
}: {
  data: Dataset
  spec: ChartSpec
  onChange: (s: ChartSpec) => void
  exportPanel: ReactNode
  step: Step | null
  onStep: (s: Step | null) => void
}) {
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
  const multi = spec.type === 'compare' || spec.type === 'table'
  const toggle = (s: Step) => onStep(step === s ? null : s)

  const metricSummary =
    spec.type === 'scatter'
      ? `${short(spec.y)} vs ${short(spec.x)}`
      : multi
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
        title="gráfica y fuente"
        summary={`${TYPES.find((t) => t.value === spec.type)?.label}: ${metricSummary}`}
        open={step === 1}
        onToggle={() => toggle(1)}
        onNext={() => onStep(2)}
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
        open={step === 2}
        onToggle={() => toggle(2)}
        onNext={() => onStep(3)}
      >
        <LabsStep data={data} spec={spec} r={r} onChange={(labs) => setF({ labs })} />
      </StepBox>

      <StepBox
        n={3}
        title="modelos"
        summary={`${r.shown.size} en la gráfica${spec.highlight.length ? `, ${spec.highlight.length} destacados` : ''}`}
        open={step === 3}
        onToggle={() => toggle(3)}
        onNext={() => onStep(4)}
      >
        <ModelsStep data={data} spec={spec} r={r} onChange={onChange} setF={setF} setO={setO} />
      </StepBox>

      <StepBox
        n={4}
        title="aspecto"
        summary={`${FORMATS[spec.format].label}, ${spec.locale === 'es' ? 'español' : 'english'}`}
        open={step === 4}
        onToggle={() => toggle(4)}
      >
        <Group title="formato">
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
          <p className="text-xs text-white-50">{FORMATS[spec.format].hint}</p>
          <Row label="idioma">
            <Pills
              value={spec.locale}
              options={[
                { value: 'es', label: 'español' },
                { value: 'en', label: 'english' },
              ]}
              onChange={(v) => set({ locale: v })}
            />
          </Row>
        </Group>

        <Group title="texto">
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
          <Toggle
            label="todo en minúsculas"
            checked={spec.options.lowercase}
            onChange={(v) => setO({ lowercase: v })}
          />
        </Group>

        <Group title="estilo">
          {(spec.type === 'scatter' || spec.type === 'timeline') && (
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
          )}
          {!multi && (
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
          {(spec.type === 'scatter' || spec.type === 'timeline') && (
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
          {(spec.type === 'scatter' || spec.type === 'timeline') && (
            <Toggle
              label={spec.type === 'scatter' ? 'línea de frontera de pareto' : 'línea de récords'}
              checked={spec.options.frontier}
              onChange={(v) => setO({ frontier: v })}
            />
          )}
          {spec.type === 'scatter' && (
            <Toggle
              label="eje horizontal logarítmico"
              checked={spec.options.logX}
              onChange={(v) => setO({ logX: v })}
            />
          )}
          {(spec.type === 'scatter' || spec.type === 'timeline') && (
            <Toggle
              label="eje vertical logarítmico"
              checked={spec.options.logY}
              onChange={(v) => setO({ logY: v })}
            />
          )}
          {(spec.type === 'bars' || spec.type === 'table') && (
            <Toggle
              label="laboratorio bajo cada modelo"
              checked={spec.options.showLab}
              onChange={(v) => setO({ showLab: v })}
            />
          )}
        </Group>
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3 border-t border-white-20 pt-4 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-semibold tracking-widest text-white-50">{title}</h4>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-white-80">{label}</span>
      {children}
    </div>
  )
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

// ---- 1. source and metric ----------------------------------------------------

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
  const byId = useMemo(() => new Map(data.metrics.map((m) => [m.id, m])), [data])
  const active = multi ? spec.metrics[0] : spec.type === 'scatter' ? spec[slot] : spec.y
  const [source, setSource] = useState<SourceId>(byId.get(active)?.source ?? 'cursor')
  const [more, setMore] = useState(false)
  const sources = SOURCE_ORDER.filter((s) => data.metrics.some((m) => m.source === s))
  const sourceName = (id: SourceId) =>
    data.sources.find((s) => s.id === id)?.name.toLowerCase() ?? id
  const list = data.metrics
    .filter((m) => m.source === source)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
  const shown = more ? list : list.slice(0, 12)

  const pick = (m: MetricDef) => {
    if (multi) {
      const has = spec.metrics.includes(m.id)
      onChange({
        ...spec,
        metrics: has ? spec.metrics.filter((x) => x !== m.id) : [...spec.metrics, m.id],
        title: null,
        subtitle: null,
      })
    } else if (spec.type === 'scatter') {
      // a benchmark with a cost per task brings its cost to the other axis
      const cost = slot === 'y' ? byId.get(`${m.id}-cost`) : undefined
      if (cost)
        return onChange({
          ...spec,
          y: m.id,
          x: cost.id,
          title: null,
          subtitle: null,
          options: { ...spec.options, logX: true, logY: false },
        })
      onChange({
        ...spec,
        [slot]: m.id,
        title: null,
        subtitle: null,
        options: { ...spec.options, ...(slot === 'x' ? { logX: !!m.log } : { logY: false }) },
      })
      if (slot === 'y') setSlot('x')
    } else
      onChange({
        ...spec,
        y: m.id,
        title: null,
        subtitle: null,
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
              onClick={() => {
                setSlot(k)
                const src = byId.get(spec[k])?.source
                if (src) setSource(src)
              }}
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
          columnas, en el orden en que las marcas:{' '}
          <span className="text-white-80 lowercase">
            {spec.metrics.map((id) => byId.get(id)?.short.es ?? id).join(', ') || 'ninguna'}
          </span>
        </p>
      )}

      <div>
        <p className="mb-1.5 text-xs tracking-widest text-white-50">fuente</p>
        <div className="flex flex-wrap gap-1.5">
          {sources.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSource(s)
                setMore(false)
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${source === s ? 'bg-white text-bg' : 'border border-white-30 text-white-80 hover:border-white'}`}
            >
              {sourceName(s)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs tracking-widest text-white-50">métrica</p>
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
          <button
            onClick={() => setMore(!more)}
            className="mt-2 text-xs text-white-50 hover:text-white"
          >
            {more ? 'ver menos' : `ver las ${list.length} métricas de ${sourceName(source)}`}
          </button>
        )}
        <p className="mt-2 text-xs text-white-50">el número es cuántos modelos tienen ese dato.</p>
      </div>
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
  r: Resolved
  onChange: (labs: string[]) => void
}) {
  const [q, setQ] = useState('')
  const counts = new Map<string, number>()
  for (const m of r.candidates) counts.set(m.lab, (counts.get(m.lab) ?? 0) + 1)
  const labs = data.labs
    .filter((l) => l.id !== 'other' && (!q || l.name.toLowerCase().includes(q.toLowerCase())))
    .sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name),
    )
  const sel = spec.filter.labs
  const toggle = (id: string) =>
    onChange(sel.includes(id) ? sel.filter((l) => l !== id) : [...sel, id])
  const preset = (ids: string[]) => onChange(ids.filter((l) => counts.has(l)))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <Pill on={sel.length === 0} onClick={() => onChange([])}>
          todos
        </Pill>
        <Pill on={false} onClick={() => preset(['openai', 'anthropic', 'google', 'xai', 'meta'])}>
          grandes
        </Pill>
        <Pill
          on={false}
          onClick={() =>
            preset([
              'deepseek',
              'alibaba',
              'moonshot',
              'zai',
              'minimax',
              'bytedance',
              'tencent',
              'baidu',
              'xiaomi',
              'stepfun',
            ])
          }
        >
          china
        </Pill>
        <Pill
          on={false}
          onClick={() =>
            preset([
              'meta',
              'deepseek',
              'alibaba',
              'mistral',
              'google',
              'microsoft',
              'nvidia',
              'zai',
              'moonshot',
            ])
          }
        >
          abiertos
        </Pill>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`buscar entre ${data.labs.length - 1} laboratorios`}
        className={inputClass}
      />
      <div className="scrollbar-thin grid max-h-[26rem] grid-cols-3 gap-2 overflow-y-auto pr-1">
        {labs.map((l) => {
          const on = sel.includes(l.id)
          const n = counts.get(l.id) ?? 0
          return (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors ${on ? 'border-white bg-white text-bg' : n ? 'border-white-20 hover:border-white-50' : 'border-white-10 opacity-45 hover:opacity-80'}`}
            >
              {on &&
                spec.options.series === 'lab' &&
                (spec.type === 'scatter' || spec.type === 'timeline') && (
                  <span className="absolute top-1.5 right-1.5" title="su forma en la gráfica">
                    <ShapeIcon shape={r.shapeOf(l.id)} color={CYAN} />
                  </span>
                )}
              <LabLogo lab={l.id} name={l.name} className="h-6 w-6" />
              <span className="w-full truncate text-center text-xs font-semibold lowercase">
                {l.name}
              </span>
              <span className={`text-[0.65rem] ${on ? 'opacity-60' : 'text-white-50'}`}>
                {n ? `${n} modelos` : 'sin datos'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-white-50">
        sin ninguno marcado entran todos. "sin datos" significa que ese laboratorio no tiene la
        métrica elegida.
      </p>
    </div>
  )
}

// ---- 3. models --------------------------------------------------------------

type View = 'rec' | 'all' | 'on'
type Sort = 'release' | 'score' | 'name'

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
  r: Resolved
  onChange: (s: ChartSpec) => void
  setF: (p: Partial<ChartSpec['filter']>) => void
  setO: (p: Partial<ChartSpec['options']>) => void
}) {
  const [view, setView] = useState<View>('rec')
  const [sort, setSort] = useState<Sort>('release')
  const [q, setQ] = useState('')
  const labName = new Map(data.labs.map((l) => [l.id, l.name]))
  const req = requiredMetrics(spec)
  const multi = spec.type === 'compare' || spec.type === 'table'
  const rankId = spec.filter.rankBy ?? (multi ? spec.metrics[0] : spec.y)
  const rankDef = data.metrics.find((m) => m.id === rankId)
  const candidateIds = useMemo(() => new Set(r.candidates.map((m) => m.id)), [r])
  const variants = useMemo(() => {
    const out = new Map<string, Model[]>()
    for (const m of data.models)
      if (m.family) (out.get(m.family) ?? out.set(m.family, []).get(m.family)!).push(m)
    return out
  }, [data])
  const hasData = (m: Model) => req.every((id) => m.values[id] !== undefined)
  const anyEfforts = useMemo(
    () => data.models.some((m) => m.family && hasData(m)),
    [data, spec.x, spec.y, spec.type],
  ) // eslint-disable-line react-hooks/exhaustive-deps

  const f = spec.filter
  const toggle = (id: string) => {
    const on = r.shown.has(id)
    setF({
      include: on ? f.include.filter((x) => x !== id) : [...f.include.filter((x) => x !== id), id],
      exclude: on ? [...f.exclude.filter((x) => x !== id), id] : f.exclude.filter((x) => x !== id),
    })
  }
  const setMany = (ids: string[], on: boolean) =>
    setF({
      include: on
        ? [...new Set([...f.include, ...ids])]
        : f.include.filter((x) => !ids.includes(x)),
      exclude: on
        ? f.exclude.filter((x) => !ids.includes(x))
        : [...new Set([...f.exclude, ...ids])],
    })
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

  const score = (m: Model) =>
    rankDef && m.values[rankDef.id] !== undefined
      ? rankDef.higherIsBetter
        ? -m.values[rankDef.id]
        : m.values[rankDef.id]
      : Infinity
  const order = (a: Model, b: Model) =>
    sort === 'release'
      ? (b.releaseDate ?? '').localeCompare(a.releaseDate ?? '') || score(a) - score(b)
      : sort === 'score'
        ? score(a) - score(b)
        : a.name.localeCompare(b.name)

  const needle = q.trim().toLowerCase()
  const inView = (m: Model) =>
    view === 'on'
      ? r.shown.has(m.id)
      : view === 'rec'
        ? r.recommended.has(m.id) || r.shown.has(m.id)
        : true
  const groups = useMemo(() => {
    const byLab = new Map<string, Model[]>()
    for (const m of r.candidates) {
      if (!inView(m)) continue
      const lab = labName.get(m.lab) ?? m.lab
      if (needle && !`${m.name} ${lab}`.toLowerCase().includes(needle)) continue
      ;(byLab.get(m.lab) ?? byLab.set(m.lab, []).get(m.lab)!).push(m)
    }
    const picked = spec.filter.labs
    return [...byLab.entries()]
      .filter(([lab]) => !picked.length || picked.includes(lab) || needle)
      .map(([lab, models]) => ({
        lab,
        models: models.sort(order),
        on: models.filter((m) => r.shown.has(m.id)).length,
      }))
      .sort((a, b) => {
        const ia = picked.indexOf(a.lab)
        const ib = picked.indexOf(b.lab)
        if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
        return b.on - a.on || b.models.length - a.models.length
      })
  }, [r, view, sort, needle, spec.filter.labs]) // eslint-disable-line react-hooks/exhaustive-deps

  const missing = req.map((id) => data.metrics.find((d) => d.id === id)?.short.es ?? id).join(' y ')
  const touched = f.include.length + f.exclude.length

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="buscar modelo o laboratorio"
        className={inputClass}
      />
      <div className="space-y-2">
        <Row label="ver">
          <Pills
            value={view}
            options={[
              {
                value: 'rec',
                label: 'últimos',
                hint: 'el modelo más reciente de cada línea de cada laboratorio',
              },
              { value: 'all', label: 'todos' },
              { value: 'on', label: `marcados ${r.shown.size}` },
            ]}
            onChange={setView}
          />
        </Row>
        <Row label="orden">
          <Pills
            value={sort}
            options={[
              { value: 'release', label: 'lanzamiento' },
              { value: 'score', label: rankDef ? rankDef.short.es.toLowerCase() : 'puntuación' },
              { value: 'name', label: 'nombre' },
            ]}
            onChange={setSort}
          />
        </Row>
      </div>

      {(spec.type === 'scatter' || spec.type === 'bars' || spec.type === 'timeline') &&
        anyEfforts && (
          <Toggle
            label="todos los niveles de esfuerzo, unidos"
            checked={spec.options.efforts === 'all'}
            onChange={(v) => setO({ efforts: v ? 'all' : 'best' })}
          />
        )}
      {spec.type === 'scatter' &&
        spec.options.efforts === 'all' &&
        data.metrics.find((m) => m.id === spec.x)?.unit === 'usd_per_mtok' && (
          <p className="rounded-lg border border-white-30 p-2 text-xs text-white-80">
            el precio por token es igual en todos los esfuerzos, así que saldrán en vertical. para
            ver cuánto cuesta cada esfuerzo usa un coste por tarea en el eje horizontal.
          </p>
        )}

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white-50">
        <span className="flex items-center gap-1.5">
          <StarIcon on /> destaca: blanco puro, el resto se apaga.
        </span>
        {touched > 0 && (
          <button
            className="underline hover:text-white"
            onClick={() => setF({ include: [], exclude: [] })}
          >
            volver a la selección inicial
          </button>
        )}
      </p>

      {groups.length === 0 && (
        <p className="py-4 text-sm text-white-50">
          {needle
            ? 'nada coincide con la búsqueda.'
            : `ningún modelo tiene ${missing || 'esos datos'}.`}
        </p>
      )}

      <div className="space-y-5">
        {groups.map((g) => (
          <LabGroup
            key={g.lab}
            lab={g.lab}
            name={labName.get(g.lab) ?? g.lab}
            shape={
              spec.options.series === 'lab' &&
              (spec.type === 'scatter' || spec.type === 'timeline') &&
              g.on > 0
                ? r.shapeOf(g.lab)
                : null
            }
            models={g.models}
            on={g.on}
            // labs with nothing on the chart start folded, so the list stays short
            startOpen={
              g.on > 0 || !!needle || spec.filter.labs.includes(g.lab) || groups.length <= 4
            }
            isShown={(m) => r.shown.has(m.id)}
            isStarred={(m) => spec.highlight.includes(m.id)}
            value={(m) =>
              rankDef && m.values[rankDef.id] !== undefined
                ? formatValue(m.values[rankDef.id], rankDef.unit)
                : null
            }
            efforts={(m) =>
              (variants.get(m.id) ?? [])
                .filter(hasData)
                .sort((a, b) => effortRank(a.effort) - effortRank(b.effort))
            }
            picked={(m) => spec.effortPick[m.id] ?? []}
            tone={spec.options.color === 'model' ? (m) => r.tone(m) : null}
            onToggle={toggle}
            onStar={star}
            onEffort={pickEffort}
            onAll={(on) =>
              setMany(
                g.models.map((m) => m.id),
                on,
              )
            }
          />
        ))}
      </div>

      {view !== 'all' && (
        <button
          onClick={() => setView('all')}
          className="text-xs text-white-50 underline hover:text-white"
        >
          ver también los modelos anteriores ({candidateIds.size} con datos)
        </button>
      )}
    </div>
  )
}

function LabGroup(p: {
  lab: string
  name: string
  shape: Shape | null
  models: Model[]
  on: number
  startOpen: boolean
  isShown: (m: Model) => boolean
  isStarred: (m: Model) => boolean
  value: (m: Model) => string | null
  efforts: (m: Model) => Model[]
  picked: (m: Model) => string[]
  tone: ((m: Model) => number) | null
  onToggle: (id: string) => void
  onStar: (id: string) => void
  onEffort: (id: string, e: string) => void
  onAll: (on: boolean) => void
}) {
  const [open, setOpen] = useState<boolean | null>(null)
  const [openEfforts, setOpenEfforts] = useState<string[]>([])
  const isOpen = open ?? p.startOpen

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!isOpen)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <LabLogo lab={p.lab} name={p.name} className="h-5 w-5" />
          <span className="truncate font-semibold lowercase">{p.name}</span>
          {p.shape && <ShapeIcon shape={p.shape} />}
          <span className="text-xs text-white-50">
            {p.on}/{p.models.length}
          </span>
          <span className={`text-white-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            <svg
              width="10"
              height="10"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M3 5l4 4 4-4" />
            </svg>
          </span>
        </button>
        {isOpen && (
          <span className="flex gap-3 text-xs text-white-50">
            <button className="hover:text-white" onClick={() => p.onAll(true)}>
              todos
            </button>
            <button className="hover:text-white" onClick={() => p.onAll(false)}>
              ninguno
            </button>
          </span>
        )}
      </div>
      {isOpen && (
        <div className="mt-2 space-y-1">
          {p.models.map((m) => {
            const on = p.isShown(m)
            const starred = p.isStarred(m)
            const effs = on ? p.efforts(m) : []
            const val = p.value(m)
            const picked = p.picked(m)
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
                        title="su opacidad en la gráfica"
                      />
                    )}
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
                      onClick={() =>
                        setOpenEfforts(
                          openEfforts.includes(m.id)
                            ? openEfforts.filter((x) => x !== m.id)
                            : [...openEfforts, m.id],
                        )
                      }
                      title="elegir niveles de esfuerzo"
                      className={`shrink-0 rounded-full px-1.5 text-[0.65rem] font-semibold ${picked.length ? 'bg-white text-bg' : 'border border-white-30 text-white-50 hover:text-white'}`}
                    >
                      {picked.length ? `${picked.length}/${effs.length}` : `${effs.length} esf.`}
                    </button>
                  )}
                  {val && (
                    <span className="shrink-0 text-xs font-semibold text-white-80">{val}</span>
                  )}
                  <button
                    onClick={() => p.onStar(m.id)}
                    title={starred ? 'quitar destacado' : 'destacar'}
                    className={`shrink-0 ${starred ? 'text-white' : 'text-white-30 hover:text-white'}`}
                  >
                    <StarIcon on={starred} />
                  </button>
                </div>
                {effs.length > 1 && (openEfforts.includes(m.id) || picked.length > 0) && (
                  <div className="mt-1 mb-2 ml-8 flex flex-wrap items-center gap-1">
                    <span className="mr-1 text-[0.65rem] text-white-50">esfuerzo</span>
                    {effs.map((v) => {
                      const sel = picked.includes(v.effort!)
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

// the lab's marker as it appears on the chart; cyan when it sits on a white tile
function ShapeIcon({ shape, color }: { shape: Shape; color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-label={`forma: ${shape}`}>
      <Marker shape={shape} x={7} y={7} r={4.5} color={color ?? '#ffffff'} />
    </svg>
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

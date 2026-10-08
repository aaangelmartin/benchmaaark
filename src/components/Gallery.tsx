// the home: every chart the data allows, grouped by source and filterable by
// source and kind. a click opens a fresh editor on that chart.
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  catalogue,
  type Entry,
  entrySpec,
  type Kind,
  KIND_LABEL,
  SOURCE_ORDER,
} from '../charts/catalogue.ts'
import { Poster } from '../charts/Poster.tsx'
import { type ChartSpec, FORMATS, type FormatId } from '../charts/spec.ts'
import { CAN_SWITCH_LANG, L, useLang } from '../lib/lang.ts'
import type { Dataset, SourceId } from '../lib/types.ts'
import { Button, inputClass, Pills } from './ui.tsx'

// posters are only drawn once they scroll into view: there are a few hundred
export function LazyPoster({ data, spec }: { data: Dataset; spec: ChartSpec }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)
  const { w, h } = FORMATS[spec.format]
  useEffect(() => {
    if (seen || !ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px' },
    )
    io.observe(ref.current)
    return () => io.disconnect()
  }, [seen])
  return (
    <div ref={ref} style={{ aspectRatio: `${w} / ${h}` }} className="bg-white-10">
      {seen && <Poster data={data} spec={spec} className="block h-auto w-full" />}
    </div>
  )
}

export function Card({
  children,
  onClick,
  title,
}: {
  children: ReactNode
  onClick: () => void
  title?: string
}) {
  return (
    <button onClick={onClick} title={title} className="group block w-full text-left">
      <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.2)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.6)]">
        {children}
      </div>
    </button>
  )
}

export function Gallery({
  data,
  onOpen,
  onNew,
  onExportAll,
  busy,
}: {
  data: Dataset
  onOpen: (e: Entry) => void
  onNew: () => void
  onExportAll: (entries: Entry[], format: FormatId) => void
  busy: string | null
}) {
  const locale = useLang()
  const all = useMemo(() => catalogue(data), [data])
  const [source, setSource] = useState<SourceId | 'all'>('all')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [format, setFormat] = useState<FormatId>('landscape')
  const [q, setQ] = useState('')

  const sourceName = (id: SourceId) =>
    data.sources.find((s) => s.id === id)?.name.toLowerCase() ?? id
  const sources = SOURCE_ORDER.filter((s) => all.some((e) => e.source === s))
  const match = (e: Entry) =>
    (source === 'all' || e.source === source) &&
    (kind === 'all' || (kind === 'featured' ? e.featured : e.kind === kind)) &&
    (!q ||
      `${e.name.es} ${e.name.en} ${sourceName(e.source)}`.toLowerCase().includes(q.toLowerCase()))
  const shown = all.filter(match)
  const kinds = (Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).filter((k) =>
    all.some((e) => e.kind === k && (source === 'all' || e.source === source)),
  )
  const count = (p: (e: Entry) => boolean) => all.filter(p).length

  const cols =
    format === 'story'
      ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5'
      : format === 'landscape' || format === 'og'
        ? 'sm:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  // one section per source, its curated charts first
  const groups: Array<{ title: string; entries: Entry[] }> =
    source === 'all' && !q
      ? sources.map((s) => ({ title: sourceName(s), entries: shown.filter((e) => e.source === s) }))
      : [{ title: '', entries: shown }]

  return (
    <div className="pb-12">
      <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 pt-12 pb-10 md:px-6">
        <div>
          <h1 className="mb-3 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
            {L('gráficas de modelos de ia', 'charts of ai models')}
          </h1>
          <p className="max-w-2xl text-white-80">
            {all.length}{' '}
            {L(
              'gráficas listas para publicar, con datos de',
              'charts ready to publish, with data from',
            )}{' '}
            {sources.map(sourceName).join(', ')}{' '}
            {L(
              'actualizados cada 6 horas. elige una para ajustarla o crea la tuya.',
              'refreshed every 6 hours. pick one to adjust it or build your own.',
            )}
          </p>
        </div>
        <Button solid onClick={onNew}>
          {L('crear desde cero', 'start from scratch')}
        </Button>
      </div>

      {/* the bar runs the full width of the page, its content stays on the grid */}
      <div className="sticky top-14 z-20 mb-10 border-b border-white-20 bg-bg">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <FilterRow label={L('fuente', 'source')}>
              <Chip on={source === 'all'} onClick={() => setSource('all')}>
                {L('todas', 'all')} <Num>{all.length}</Num>
              </Chip>
              {sources.map((s) => (
                <Chip key={s} on={source === s} onClick={() => setSource(s)}>
                  {sourceName(s)} <Num>{count((e) => e.source === s)}</Num>
                </Chip>
              ))}
            </FilterRow>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <FilterRow label={L('tipo', 'kind')}>
              <Chip on={kind === 'all'} onClick={() => setKind('all')}>
                {L('todos', 'all')}
              </Chip>
              <Chip on={kind === 'featured'} onClick={() => setKind('featured')}>
                {L('destacadas', 'featured')}
              </Chip>
              {kinds.map((k) => (
                <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
                  {KIND_LABEL[k][locale]}
                </Chip>
              ))}
            </FilterRow>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={L('buscar gráfica', 'search charts')}
                className={`${inputClass} !w-44 !rounded-full !py-1 text-xs`}
              />
              <Pills
                value={format}
                options={(Object.keys(FORMATS) as FormatId[]).map((f) => ({
                  value: f,
                  label: FORMATS[f].label,
                  hint: FORMATS[f].hint,
                }))}
                onChange={setFormat}
              />
              <Button
                disabled={!!busy || shown.length === 0}
                onClick={() => onExportAll(shown, format)}
                title={
                  CAN_SWITCH_LANG
                    ? L(
                        'descargar en un zip las gráficas que se ven ahora, en es y en',
                        'download the charts on screen as a zip, in es and en',
                      )
                    : 'download the charts on screen as a zip'
                }
              >
                {busy?.startsWith('templates')
                  ? busy.replace('templates', 'zip')
                  : `${L('exportar', 'export')} ${shown.length}`}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {shown.length === 0 && (
        <p className="py-20 text-center text-white-50">
          {L('ninguna gráfica con esos filtros.', 'no charts match those filters.')}
        </p>
      )}
      <div className="mx-auto max-w-7xl space-y-14 px-4 md:px-6">
        {groups
          .filter((g) => g.entries.length)
          .map((g) => (
            <section key={g.title}>
              {g.title && (
                <h2 className="mb-5 flex items-baseline gap-3 text-xl font-bold tracking-[-0.03em]">
                  {g.title}{' '}
                  <span className="text-sm font-medium text-white-50">{g.entries.length}</span>
                </h2>
              )}
              <div className={`grid gap-x-6 gap-y-8 ${cols}`}>
                {g.entries.map((e) => (
                  <div key={e.id}>
                    <Card
                      onClick={() => onOpen(e)}
                      title={L('abrir en el editor', 'open in the editor')}
                    >
                      <LazyPoster data={data} spec={entrySpec(e, { format, locale })} />
                    </Card>
                    <p className="mt-2.5 truncate text-sm font-semibold lowercase">
                      {e.name[locale]}
                    </p>
                    <p className="text-xs text-white-50 lowercase">
                      {sourceName(e.source)},{' '}
                      {KIND_LABEL[e.kind === 'featured' ? 'bars' : e.kind][locale]}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-12 text-xs tracking-widest text-white-50">{label}</span>
      {children}
    </div>
  )
}

function Chip({
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
      className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${on ? 'bg-solid text-on-solid' : 'border border-white-30 text-white-80 hover:border-white hover:text-white'}`}
    >
      {children}
    </button>
  )
}

const Num = ({ children }: { children: ReactNode }) => (
  <span className="ml-0.5 font-medium opacity-60">{children}</span>
)

import { useEffect, useMemo, useRef, useState } from 'react'
import { type Entry, entrySpec } from './charts/catalogue.ts'
import {
  applyTemplate,
  autoTitle,
  type ChartSpec,
  decodeSpec,
  DEFAULT_SPEC,
  encodeSpec,
  FORMATS,
  type FormatId,
  normalizeSpec,
  resolve,
  TEMPLATES,
} from './charts/spec.ts'
import { DataView } from './components/DataView.tsx'
import { Editor, type Step } from './components/Editor.tsx'
import { Card, Gallery, LazyPoster } from './components/Gallery.tsx'
import { InteractivePoster } from './components/InteractivePoster.tsx'
import { ModelDrawer } from './components/ModelDrawer.tsx'
import { Button } from './components/ui.tsx'
import { BRAND } from './lib/brand.ts'
import { CAN_SWITCH_LANG, getLang, L, setLang, useLang } from './lib/lang.ts'
import {
  type BatchItem,
  copyPng,
  download,
  exportZip,
  fileBase,
  posterCsv,
  posterPng,
  posterSvg,
} from './lib/export.ts'
import { loadSaved, newId, removeSaved, type SavedChart, upsertSaved } from './lib/saved.ts'
import type { Dataset, Locale } from './lib/types.ts'

// the languages a batch export covers: both on aaa., english only on laaabs.
const EXPORT_LANGS: Locale[] = CAN_SWITCH_LANG ? ['es', 'en'] : ['en']
import { type DataStatus, useDataset } from './lib/useDataset.ts'

type View = 'gallery' | 'editor' | 'saved' | 'models'

// #/editor/<spec>, #/mis-graficas, #/modelos; anything else is the gallery
function fromHash(): { view: View; spec: ChartSpec | null } {
  const h = location.hash
  if (h.startsWith('#/editor/')) return { view: 'editor', spec: decodeSpec(h.slice(9)) }
  if (h === '#/mis-graficas') return { view: 'saved', spec: null }
  if (h === '#/modelos') return { view: 'models', spec: null }
  return { view: 'gallery', spec: null }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'chart'

export function App() {
  // read here so the whole tree re-renders when the language changes
  const lang = useLang()
  const { data, error, status } = useDataset()
  const initial = useMemo(fromHash, [])
  const [view, setView] = useState<View>(initial.view)
  const [spec, setSpec] = useState<ChartSpec>(
    () => initial.spec ?? applyTemplate(TEMPLATES[0], { ...DEFAULT_SPEC, locale: getLang() }),
  )
  const [step, setStep] = useState<Step | null>(2)
  const [done, setDone] = useState<Step[]>([1])
  const [busy, setBusy] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedChart[]>(loadSaved)
  // the chart being edited is saved under this id from its first change on
  const savedId = useRef<string | null>(null)
  const pristine = useRef(true)

  useEffect(() => {
    const hash =
      view === 'editor'
        ? `#/editor/${encodeSpec(spec)}`
        : view === 'saved'
          ? '#/mis-graficas'
          : view === 'models'
            ? '#/modelos'
            : '#/'
    history.replaceState(null, '', hash)
  }, [spec, view])

  // the open chart follows the site language, without counting as an edit
  useEffect(() => {
    setSpec((s) => (s.locale === lang ? s : { ...s, locale: lang }))
  }, [lang])

  useEffect(() => {
    const onHash = () => {
      const h = fromHash()
      setView(h.view)
      if (h.spec) setSpec(h.spec)
    }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try {
      await fn()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const go = (v: View) => {
    setView(v)
    setModel(null)
    scrollTo({ top: 0 })
  }

  // every chart opened from the gallery starts clean: nothing carries over
  const openFresh = (next: ChartSpec, at: Step) => {
    savedId.current = null
    pristine.current = true
    setSpec(next)
    setStep(at)
    // a chart from the gallery arrives with its first step already answered
    setDone(([1, 2, 3, 4] as Step[]).filter((n) => n < at))
    go('editor')
  }

  const chartName = (s: ChartSpec) =>
    data ? autoTitle(s, resolve(data, s)).title.toLowerCase() : L('gráfica', 'chart')

  // edits are kept in the browser as you go
  const edit = (next: ChartSpec) => {
    setSpec(next)
    pristine.current = false
    savedId.current ??= newId()
    setSaved(
      upsertSaved({
        id: savedId.current,
        name: chartName(next),
        spec: next,
        savedAt: new Date().toISOString(),
      }),
    )
  }

  if (!data)
    return (
      <Centered>
        {error
          ? L(
              'todavía no hay datos. se están descargando, espera un momento.',
              'no data yet. it is being downloaded, give it a moment.',
            )
          : L('cargando datos...', 'loading data...')}
      </Centered>
    )

  const fixed = normalizeSpec(spec, data)
  if (JSON.stringify(fixed) !== JSON.stringify(spec)) {
    setSpec(fixed)
    return null
  }

  const drawerActions = (id: string) => {
    if (view !== 'editor') {
      const t = TEMPLATES[0]
      return [
        {
          label: L('ver en inteligencia vs coste', 'see in intelligence vs cost'),
          onClick: () =>
            openFresh(
              {
                ...applyTemplate(t, { ...DEFAULT_SPEC, locale: lang }),
                highlight: [id],
                filter: { ...applyTemplate(t).filter, include: [id] },
              },
              3,
            ),
        },
      ]
    }
    const on = spec.highlight.includes(id)
    const shown = resolve(data, spec).shown.has(id)
    return [
      {
        label: on
          ? L('quitar el destacado', 'remove highlight')
          : L('destacar en esta gráfica', 'highlight in this chart'),
        onClick: () => {
          edit({
            ...spec,
            highlight: on ? spec.highlight.filter((h) => h !== id) : [...spec.highlight, id],
          })
          setModel(null)
        },
      },
      {
        label: shown
          ? L('quitar de la gráfica', 'remove from the chart')
          : L('añadir a la gráfica', 'add to the chart'),
        onClick: () => {
          const f = spec.filter
          edit({
            ...spec,
            filter: {
              ...f,
              include: shown ? f.include.filter((x) => x !== id) : [...f.include, id],
              exclude: shown ? [...f.exclude, id] : f.exclude.filter((x) => x !== id),
            },
          })
          setModel(null)
        },
      },
    ]
  }

  const name = slug(chartName(spec))
  const base = `${fileBase(spec, name, data.generatedAt)}${BRAND.id === 'aaa' ? '' : `-${BRAND.id}`}`
  const exportPanel = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          solid
          disabled={!!busy}
          onClick={() =>
            run('png', async () => download(await posterPng(data, spec, 2), `${base}.png`))
          }
        >
          {busy === 'png' ? L('exportando...', 'exporting...') : L('descargar png', 'download png')}
        </Button>
        <Button
          disabled={!!busy}
          title={L(
            'copiar el png para pegarlo directamente en x',
            'copy the png to paste it straight into x',
          )}
          onClick={() => run('copy', async () => copyPng(await posterPng(data, spec, 2)))}
        >
          {busy === 'copy' ? L('copiado', 'copied') : L('copiar', 'copy')}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-white-50">
        <button
          className="hover:text-white"
          onClick={() =>
            run('svg', async () =>
              download(await posterSvg(data, spec), `${base}.svg`, 'image/svg+xml'),
            )
          }
        >
          svg
        </button>
        <button
          className="hover:text-white"
          onClick={() =>
            run('csv', async () =>
              download(posterCsv(data, spec), `${name}-${spec.locale}.csv`, 'text/csv'),
            )
          }
        >
          csv
        </button>
        <button
          className="hover:text-white"
          title={
            CAN_SWITCH_LANG
              ? L(
                  'esta gráfica en todos los formatos y en los dos idiomas',
                  'this chart in every format and both languages',
                )
              : 'this chart in every format'
          }
          onClick={() =>
            run('formats', async () => {
              const items: BatchItem[] = (Object.keys(FORMATS) as FormatId[]).flatMap((format) =>
                EXPORT_LANGS.map((l) => ({
                  name,
                  spec: { ...spec, format, locale: l },
                })),
              )
              download(
                await exportZip(
                  data,
                  items,
                  { png: true, svg: true, csv: true, scale: 2 },
                  (d, t) => setBusy(`formats ${d}/${t}`),
                ),
                `${name}-${L('todos-los-formatos', 'all-formats')}.zip`,
              )
            })
          }
        >
          {busy?.startsWith('formats')
            ? busy.replace('formats', 'zip')
            : L('todos los formatos', 'all formats')}
        </button>
        <span className="ml-auto font-medium">
          {pristine.current
            ? L('sin cambios', 'no changes')
            : L('guardada en mis gráficas', 'saved in my charts')}
        </span>
      </div>
    </div>
  )

  return (
    // in the editor the whole page is exactly one screen: header, editor, footer
    <div
      className={`flex min-h-dvh flex-col ${view === 'editor' ? 'lg:h-dvh lg:overflow-hidden' : ''}`}
    >
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white-20 bg-bg px-4 md:px-6">
        <button onClick={() => go('gallery')} className="flex items-center gap-3">
          <svg
            viewBox={`0 0 ${BRAND.mark.w} ${BRAND.mark.h}`}
            className="h-3.5 w-auto"
            aria-label={BRAND.name}
            dangerouslySetInnerHTML={{ __html: BRAND.mark.inner }}
          />
          <span className="text-sm font-bold tracking-[-0.03em]">benchmaaark</span>
        </button>
        {/* same order as aaangelmartin.com: mark, links, language last */}
        <div className="flex items-center gap-8">
          <nav className="flex items-center gap-8">
            {(
              [
                ['gallery', L('galería', 'gallery')],
                ['editor', 'editor'],
                [
                  'saved',
                  `${L('mis gráficas', 'my charts')}${saved.length ? ` ${saved.length}` : ''}`,
                ],
                ['models', L('modelos', 'models')],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={`text-sm font-medium tracking-wide lowercase transition-opacity duration-300 ${view === id ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
              >
                {BRAND.id === 'laaabs' && view === id && (
                  <span className="mr-1.5 mb-0.5 inline-block h-1 w-1 rounded-full bg-[#00b5e2] align-middle" />
                )}
                {label}
              </button>
            ))}
          </nav>
          {CAN_SWITCH_LANG && (
            <div
              className="flex items-center gap-0.5 text-sm font-medium"
              aria-label={L('idioma', 'language')}
            >
              <button
                onClick={() => setLang('es')}
                aria-pressed={lang === 'es'}
                className={`px-1.5 py-0.5 transition-opacity duration-300 ${lang === 'es' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
              >
                es
              </button>
              <span className="opacity-30">/</span>
              <button
                onClick={() => setLang('en')}
                aria-pressed={lang === 'en'}
                className={`px-1.5 py-0.5 transition-opacity duration-300 ${lang === 'en' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
              >
                en
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view === 'gallery' && (
          <Gallery
            data={data}
            busy={busy}
            onOpen={(e: Entry) => openFresh(entrySpec(e, { format: 'landscape', locale: lang }), 2)}
            onNew={() =>
              openFresh(
                {
                  ...DEFAULT_SPEC,
                  locale: lang,
                  type: 'bars',
                  y: 'cursorbench',
                  title: null,
                  subtitle: null,
                },
                1,
              )
            }
            onExportAll={(entries, format) =>
              run('templates', async () => {
                const items = entries.flatMap((e) =>
                  EXPORT_LANGS.map((l) => ({
                    name: e.id,
                    spec: entrySpec(e, { format, locale: l }),
                  })),
                )
                download(
                  await exportZip(
                    data,
                    items,
                    { png: true, svg: false, csv: true, scale: 2 },
                    (d, n) => setBusy(`templates ${d}/${n}`),
                  ),
                  `benchmaaark-${format}.zip`,
                )
              })
            }
          />
        )}

        {view === 'editor' && (
          // the editor fills the screen exactly: the page never scrolls, only the sidebar does
          <div className="lg:grid lg:h-full lg:grid-cols-[400px_1fr] lg:overflow-hidden">
            <aside className="scrollbar-thin border-white-20 lg:h-full lg:overflow-y-auto lg:border-r">
              <Editor
                data={data}
                spec={spec}
                onChange={edit}
                exportPanel={exportPanel}
                step={step}
                onStep={setStep}
                done={done}
                onDone={(n) => setDone((cur) => (cur.includes(n) ? cur : [...cur, n]))}
              />
            </aside>
            {/* the poster sits in the middle of the space next to the sidebar,
                and stays there while the sidebar scrolls */}
            <main className="flex items-center justify-center p-4 md:p-8 lg:h-full lg:overflow-hidden">
              <Preview data={data} spec={spec} onSelect={setModel} />
            </main>
          </div>
        )}

        {view === 'saved' && (
          <Saved
            data={data}
            saved={saved}
            onNew={() =>
              openFresh(
                {
                  ...DEFAULT_SPEC,
                  locale: lang,
                  type: 'bars',
                  y: 'cursorbench',
                  title: null,
                  subtitle: null,
                },
                1,
              )
            }
            onOpen={(c) => {
              savedId.current = c.id
              pristine.current = false
              setSpec({ ...c.spec, locale: lang })
              setStep(3)
              setDone([1, 2])
              go('editor')
            }}
            onDuplicate={(c) =>
              setSaved(
                upsertSaved({
                  ...c,
                  id: newId(),
                  name: `${c.name} (${L('copia', 'copy')})`,
                  savedAt: new Date().toISOString(),
                }),
              )
            }
            onRemove={(c) => {
              if (savedId.current === c.id) savedId.current = null
              setSaved(removeSaved(c.id))
            }}
          />
        )}

        {view === 'models' && <DataView data={data} onSelect={setModel} />}
      </div>

      <Footer data={data} status={status} compact={view === 'editor'} />
      {model && (
        <ModelDrawer
          data={data}
          id={model}
          onClose={() => setModel(null)}
          actions={drawerActions(model)}
        />
      )}
    </div>
  )
}

function Saved({
  data,
  saved,
  onOpen,
  onNew,
  onDuplicate,
  onRemove,
}: {
  data: Dataset
  saved: SavedChart[]
  onOpen: (c: SavedChart) => void
  onNew: () => void
  onDuplicate: (c: SavedChart) => void
  onRemove: (c: SavedChart) => void
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="mb-3 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
            {L('mis gráficas', 'my charts')}
          </h1>
          <p className="max-w-2xl text-white-80">
            {L(
              'lo que editas se guarda solo en este navegador. no se envía a ningún sitio.',
              'what you edit is saved only in this browser. it is not sent anywhere.',
            )}
          </p>
        </div>
        <Button solid onClick={onNew}>
          {L('crear nueva', 'create new')}
        </Button>
      </div>
      {saved.length === 0 ? (
        <p className="py-20 text-center text-white-50">
          {L(
            'todavía no has editado ninguna gráfica. abre una de la galería o crea una nueva.',
            'you have not edited any chart yet. open one from the gallery or create a new one.',
          )}
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((c) => (
            <div key={c.id}>
              <Card onClick={() => onOpen(c)} title={L('seguir editando', 'keep editing')}>
                <LazyPoster data={data} spec={{ ...c.spec, format: 'landscape' }} />
              </Card>
              <div className="mt-2.5 flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-semibold lowercase">{c.name}</p>
                <span className="flex shrink-0 gap-3 text-xs text-white-50">
                  <button className="hover:text-white" onClick={() => onDuplicate(c)}>
                    {L('duplicar', 'duplicate')}
                  </button>
                  <button className="hover:text-white" onClick={() => onRemove(c)}>
                    {L('borrar', 'delete')}
                  </button>
                </span>
              </div>
              <p className="text-xs text-white-50">
                {L('editada el', 'edited on')}{' '}
                {new Date(c.savedAt).toLocaleDateString(getLang(), {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Footer({
  data,
  status,
  compact,
}: {
  data: Dataset
  status: DataStatus | null
  // one line, for the editor, where the page must not grow past the screen
  compact?: boolean
}) {
  const other =
    BRAND.id === 'aaa'
      ? {
          href: `${import.meta.env.BASE_URL}laaabs/`,
          label: L('edición laaabs.', 'laaabs. edition'),
        }
      : { href: import.meta.env.BASE_URL, label: L('edición aaa.', 'aaa. edition') }
  return (
    <footer
      className={`shrink-0 border-t border-white-20 px-4 text-xs text-white-50 md:px-6 ${compact ? 'py-3' : 'py-8'}`}
    >
      <div
        className={`mx-auto flex justify-between gap-6 ${compact ? 'items-center' : 'max-w-7xl flex-wrap items-start'}`}
      >
        <p className={compact ? 'min-w-0 truncate' : 'max-w-xl'}>
          {L('datos de', 'data from')}{' '}
          {data.sources
            .filter((s) => s.ok && s.id !== 'manual')
            .map((s, i, a) => (
              <span key={s.id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-white-80 lowercase hover:text-white"
                >
                  {s.name}
                </a>
                {i < a.length - 1 ? ', ' : '. '}
              </span>
            ))}
          {L('cada gráfica cita las fuentes que usa.', 'every chart credits the sources it uses.')}{' '}
          <DataAge data={data} status={status} />
        </p>
        <div className="flex shrink-0 gap-5">
          <a href={other.href} className="hover:text-white">
            {other.label}
          </a>
          <a
            href="https://github.com/aaangelmartin/benchmaaark"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            {L('código abierto', 'open source')}
          </a>
          <a href={BRAND.home} target="_blank" rel="noreferrer" className="hover:text-white">
            {BRAND.domain}
          </a>
        </div>
      </div>
    </footer>
  )
}

// how old the data is. it refreshes on its own, so there is nothing to press
function DataAge({ data, status }: { data: Dataset; status: DataStatus | null }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.round((Date.now() - Date.parse(data.generatedAt)) / 60_000)
  const ago =
    mins < 1
      ? L('ahora mismo', 'just now')
      : mins < 60
        ? L(`hace ${mins} min`, `${mins} min ago`)
        : mins < 48 * 60
          ? L(`hace ${Math.round(mins / 60)} h`, `${Math.round(mins / 60)} h ago`)
          : L(`hace ${Math.round(mins / 1440)} días`, `${Math.round(mins / 1440)} days ago`)
  return (
    <span title={new Date(data.generatedAt).toLocaleString(getLang())}>
      {status?.running
        ? L('actualizando los datos...', 'refreshing the data...')
        : L(
            `datos actualizados ${ago}. se actualizan solos cada 6 horas.`,
            `data updated ${ago}. it refreshes on its own every 6 hours.`,
          )}
    </span>
  )
}

function Preview({
  data,
  spec,
  onSelect,
}: {
  data: Dataset
  spec: ChartSpec
  onSelect: (id: string) => void
}) {
  const { w, h } = FORMATS[spec.format]
  return (
    // the caption hangs below without taking part in the centring, so it is the
    // poster itself that sits in the middle
    <div
      className="relative w-full"
      style={{ maxWidth: `min(100%, calc((100dvh - 15rem) * ${w / h}))` }}
    >
      <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_30px_80px_-20px_rgba(0,0,0,0.35)]">
        <InteractivePoster data={data} spec={spec} onSelect={onSelect} />
      </div>
      <p className="absolute top-full right-0 left-0 mt-3 text-center text-xs text-white-50">
        {w}×{h}, {FORMATS[spec.format].hint}.{' '}
        {L(
          'pasa el ratón por un punto o una barra para ver sus datos.',
          'hover a point or a bar to see its numbers.',
        )}
      </p>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center text-white-80">
      {children}
    </div>
  )
}

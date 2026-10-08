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
  const { data, error, status, refresh } = useDataset()
  const initial = useMemo(fromHash, [])
  const [view, setView] = useState<View>(initial.view)
  const [spec, setSpec] = useState<ChartSpec>(
    initial.spec ?? applyTemplate(TEMPLATES[0], DEFAULT_SPEC),
  )
  const [step, setStep] = useState<Step | null>(2)
  const [locale, setLocale] = useState<Locale>(initial.spec?.locale ?? 'es')
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
    go('editor')
  }

  const chartName = (s: ChartSpec) =>
    data ? autoTitle(s, resolve(data, s)).title.toLowerCase() : 'gráfica'

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

  if (!data) return <Centered>{error ?? 'cargando datos...'}</Centered>

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
          label: 'ver en inteligencia vs coste',
          onClick: () =>
            openFresh(
              {
                ...applyTemplate(t, { ...DEFAULT_SPEC, locale }),
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
        label: on ? 'quitar el destacado' : 'destacar en esta gráfica',
        onClick: () => {
          edit({
            ...spec,
            highlight: on ? spec.highlight.filter((h) => h !== id) : [...spec.highlight, id],
          })
          setModel(null)
        },
      },
      {
        label: shown ? 'quitar de la gráfica' : 'añadir a la gráfica',
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
          {busy === 'png' ? 'exportando...' : 'descargar png'}
        </Button>
        <Button
          disabled={!!busy}
          title="copiar el png para pegarlo directamente en x"
          onClick={() => run('copy', async () => copyPng(await posterPng(data, spec, 2)))}
        >
          {busy === 'copy' ? 'copiado' : 'copiar'}
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
          title="esta gráfica en todos los formatos y en los dos idiomas"
          onClick={() =>
            run('formats', async () => {
              const items: BatchItem[] = (Object.keys(FORMATS) as FormatId[]).flatMap((format) =>
                (['es', 'en'] as const).map((l) => ({
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
                `${name}-todos-los-formatos.zip`,
              )
            })
          }
        >
          {busy?.startsWith('formats') ? busy.replace('formats', 'zip') : 'todos los formatos'}
        </button>
        <span className="ml-auto font-medium">
          {pristine.current ? 'sin cambios' : 'guardada en mis gráficas'}
        </span>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh flex-col">
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
        <div className="flex items-center gap-5">
          <DataBadge data={data} status={status} onRefresh={refresh} />
          <nav className="flex gap-4 text-sm font-medium">
            {(
              [
                ['gallery', 'galería'],
                ['editor', 'editor'],
                ['saved', `mis gráficas${saved.length ? ` ${saved.length}` : ''}`],
                ['models', 'modelos'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => go(id)}
                className={`transition-opacity duration-300 ${view === id ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
              >
                {BRAND.id === 'laaabs' && view === id && (
                  <span className="mr-1.5 mb-0.5 inline-block h-1 w-1 rounded-full bg-[#00b5e2] align-middle" />
                )}
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex-1">
        {view === 'gallery' && (
          <Gallery
            data={data}
            locale={locale}
            onLocale={setLocale}
            busy={busy}
            onOpen={(e: Entry) => openFresh(entrySpec(e, { format: 'landscape', locale }), 2)}
            onNew={() =>
              openFresh(
                {
                  ...DEFAULT_SPEC,
                  locale,
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
                  (['es', 'en'] as const).map((l) => ({
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
          <div className="lg:grid lg:grid-cols-[400px_1fr]">
            <aside className="scrollbar-thin border-white-20 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-r">
              <Editor
                data={data}
                spec={spec}
                onChange={edit}
                exportPanel={exportPanel}
                step={step}
                onStep={setStep}
              />
            </aside>
            <main className="p-4 md:p-8">
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
                  locale,
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
              setSpec(c.spec)
              setStep(3)
              go('editor')
            }}
            onDuplicate={(c) =>
              setSaved(
                upsertSaved({
                  ...c,
                  id: newId(),
                  name: `${c.name} (copia)`,
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

      <Footer data={data} />
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
          <h1 className="mb-3 text-3xl font-bold tracking-[-0.03em] md:text-5xl">mis gráficas</h1>
          <p className="max-w-2xl text-white-80">
            lo que editas se guarda solo en este navegador. no se envía a ningún sitio.
          </p>
        </div>
        <Button solid onClick={onNew}>
          crear desde cero
        </Button>
      </div>
      {saved.length === 0 ? (
        <p className="py-20 text-center text-white-50">
          todavía no has editado ninguna gráfica. abre una de la galería o crea una desde cero.
        </p>
      ) : (
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((c) => (
            <div key={c.id}>
              <Card onClick={() => onOpen(c)} title="seguir editando">
                <LazyPoster data={data} spec={{ ...c.spec, format: 'landscape' }} />
              </Card>
              <div className="mt-2.5 flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-semibold lowercase">{c.name}</p>
                <span className="flex shrink-0 gap-3 text-xs text-white-50">
                  <button className="hover:text-white" onClick={() => onDuplicate(c)}>
                    duplicar
                  </button>
                  <button className="hover:text-white" onClick={() => onRemove(c)}>
                    borrar
                  </button>
                </span>
              </div>
              <p className="text-xs text-white-50">
                editada el{' '}
                {new Date(c.savedAt).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Footer({ data }: { data: Dataset }) {
  const other =
    BRAND.id === 'aaa'
      ? { href: `${import.meta.env.BASE_URL}laaabs/`, label: 'edición laaabs.' }
      : { href: import.meta.env.BASE_URL, label: 'edición aaa.' }
  return (
    <footer className="border-t border-white-20 px-4 py-8 text-xs text-white-50 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-6">
        <p className="max-w-xl">
          datos de{' '}
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
          cada gráfica cita las fuentes que usa.
        </p>
        <div className="flex gap-5">
          <a href={other.href} className="hover:text-white">
            {other.label}
          </a>
          <a
            href="https://github.com/aaangelmartin/benchmaaark"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            código abierto
          </a>
          <a href={BRAND.home} target="_blank" rel="noreferrer" className="hover:text-white">
            {BRAND.domain}
          </a>
        </div>
      </div>
    </footer>
  )
}

function DataBadge({
  data,
  status,
  onRefresh,
}: {
  data: Dataset
  status: DataStatus | null
  onRefresh: () => void
}) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.round((Date.now() - Date.parse(data.generatedAt)) / 60_000)
  const ago =
    mins < 1
      ? 'ahora'
      : mins < 60
        ? `hace ${mins} min`
        : mins < 48 * 60
          ? `hace ${Math.round(mins / 60)} h`
          : `hace ${Math.round(mins / 1440)} días`
  return (
    <div
      className="hidden items-center gap-2 text-xs text-white-50 md:flex"
      title={`datos generados el ${new Date(data.generatedAt).toLocaleString('es')}`}
    >
      <span>{status?.running ? 'actualizando datos...' : `datos ${ago}`}</span>
      {status && !status.running && (
        <button
          onClick={onRefresh}
          className="rounded-full border border-white-30 px-2.5 py-0.5 font-semibold text-white-80 hover:border-white hover:text-white"
        >
          actualizar
        </button>
      )}
    </div>
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
    <div className="mx-auto" style={{ maxWidth: `min(100%, calc((100dvh - 9rem) * ${w / h}))` }}>
      <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_30px_80px_-20px_rgba(0,0,0,0.35)]">
        <InteractivePoster data={data} spec={spec} onSelect={onSelect} />
      </div>
      <p className="mt-3 text-center text-xs text-white-50">
        {w}×{h}, {FORMATS[spec.format].hint}. pasa el ratón por un punto o una barra para ver sus
        datos.
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

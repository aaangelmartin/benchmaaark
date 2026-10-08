import { useEffect, useMemo, useState } from 'react'
import aaaSvg from './assets/aaa.svg?raw'
import {
  applyTemplate,
  type ChartSpec,
  decodeSpec,
  DEFAULT_SPEC,
  encodeSpec,
  normalizeSpec,
  FORMATS,
  type FormatId,
  type Template,
  TEMPLATES,
} from './charts/spec.ts'
import { DataView } from './components/DataView.tsx'
import { Editor } from './components/Editor.tsx'
import { InteractivePoster } from './components/InteractivePoster.tsx'
import { ModelDrawer } from './components/ModelDrawer.tsx'
import { Button, Pills } from './components/ui.tsx'
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
import type { Dataset, Locale } from './lib/types.ts'
import { type DataStatus, useDataset } from './lib/useDataset.ts'

type Tab = 'explore' | 'editor' | 'models'

// #/editor/<spec>, #/modelos, anything else is the explore view
function fromHash(): { tab: Tab; spec: ChartSpec | null } {
  const h = location.hash
  if (h.startsWith('#/editor/')) return { tab: 'editor', spec: decodeSpec(h.slice(9)) }
  if (h === '#/editor') return { tab: 'editor', spec: null }
  if (h === '#/modelos') return { tab: 'models', spec: null }
  return { tab: 'explore', spec: null }
}

export function App() {
  const { data, error, status, refresh } = useDataset()
  const initial = useMemo(fromHash, [])
  const [tab, setTab] = useState<Tab>(initial.tab)
  const [spec, setSpec] = useState<ChartSpec>(
    initial.spec ?? applyTemplate(TEMPLATES[0], DEFAULT_SPEC),
  )
  const [name, setName] = useState('chart')
  const [busy, setBusy] = useState<string | null>(null)
  const [model, setModel] = useState<string | null>(null)
  const [locale, setLocale] = useState<Locale>(initial.spec?.locale ?? 'es')

  useEffect(() => {
    const hash =
      tab === 'editor' ? `#/editor/${encodeSpec(spec)}` : tab === 'models' ? '#/modelos' : '#/'
    history.replaceState(null, '', hash)
  }, [spec, tab])

  useEffect(() => {
    const onHash = () => {
      const h = fromHash()
      setTab(h.tab)
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

  const openTemplate = (t: Template, extra: Partial<ChartSpec> = {}) => {
    setSpec({ ...applyTemplate(t, { ...spec, locale }), ...extra })
    setName(t.id)
    setTab('editor')
    setModel(null)
    scrollTo({ top: 0 })
  }

  if (!data) return <Centered>{error ?? 'cargando datos...'}</Centered>

  // old saved charts may use prices per token; bring them to cost per task
  const fixed = normalizeSpec(spec, data)
  if (fixed !== spec && JSON.stringify(fixed) !== JSON.stringify(spec)) {
    setSpec(fixed)
    return null
  }

  const drawerActions = (id: string) => {
    const leaders = data.models
      .filter((m) => m.values.eci !== undefined && m.id !== id)
      .slice(0, 3)
      .map((m) => m.id)
    const byId = (tid: string) => TEMPLATES.find((t) => t.id === tid)!
    const base = [
      {
        label: 'comparar con los líderes',
        onClick: () =>
          openTemplate(byId('compare-frontier'), {
            filter: { ...applyTemplate(byId('compare-frontier')).filter, models: [id, ...leaders] },
            highlight: [id],
          }),
      },
      {
        label: 'ver su coste por tarea',
        onClick: () =>
          openTemplate(byId('coding-vs-cost'), {
            highlight: [id],
            filter: { ...applyTemplate(byId('coding-vs-cost')).filter, include: [id] },
          }),
      },
    ]
    if (tab !== 'editor') return base
    const on = spec.highlight.includes(id)
    return [
      {
        label: on ? 'quitar el destacado' : 'destacar en esta gráfica',
        onClick: () => {
          setSpec({
            ...spec,
            highlight: on ? spec.highlight.filter((h) => h !== id) : [...spec.highlight, id],
          })
          setModel(null)
        },
      },
      ...base,
    ]
  }

  const base = fileBase(spec, name, data.generatedAt)
  const exportPanel = (
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
      <span className="flex gap-3 pl-1 text-xs font-semibold text-white-50">
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
                `${name}-all-formats.zip`,
              )
            })
          }
        >
          {busy?.startsWith('formats') ? busy.replace('formats', 'zip') : 'todos los formatos'}
        </button>
      </span>
    </div>
  )

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-white-20 bg-bg px-4 md:px-6">
        <button onClick={() => setTab('explore')} className="flex items-center gap-3">
          <span
            className="block h-3 w-[42px] [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: aaaSvg }}
          />
          <span className="text-sm font-bold tracking-[-0.03em]">benchmaaark</span>
        </button>
        <div className="flex items-center gap-5">
          <DataBadge data={data} status={status} onRefresh={refresh} />
          <nav className="flex gap-4 text-sm font-medium">
            {(
              [
                ['explore', 'explorar'],
                ['editor', 'editor'],
                ['models', 'modelos'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`transition-opacity duration-300 ${tab === id ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {tab === 'explore' && (
        <Explore
          data={data}
          locale={locale}
          busy={busy}
          onLocale={setLocale}
          onEdit={(t) => openTemplate(t)}
          onSelect={setModel}
          onPng={(t, s) =>
            run(`png-${t.id}`, async () =>
              download(await posterPng(data, s, 2), `${fileBase(s, t.id, data.generatedAt)}.png`),
            )
          }
          onExportAll={(format) =>
            run('templates', async () => {
              const items = TEMPLATES.flatMap((t) =>
                (['es', 'en'] as const).map((l) => ({
                  name: t.id,
                  spec: applyTemplate(t, { ...DEFAULT_SPEC, format, locale: l }),
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

      {tab === 'editor' && (
        <div className="lg:grid lg:grid-cols-[380px_1fr]">
          <aside className="scrollbar-thin border-white-20 lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:border-r">
            <Editor data={data} spec={spec} onChange={setSpec} exportPanel={exportPanel} />
          </aside>
          <main className="p-4 md:p-8">
            <Preview data={data} spec={spec} onSelect={setModel} />
          </main>
        </div>
      )}

      {tab === 'models' && <DataView data={data} onSelect={setModel} />}

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
    <div className="mx-auto" style={{ maxWidth: `min(100%, calc((100dvh - 8rem) * ${w / h}))` }}>
      <div className="overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_30px_80px_-20px_rgba(0,40,60,0.35)]">
        <InteractivePoster data={data} spec={spec} onSelect={onSelect} />
      </div>
      <p className="mt-3 text-center text-xs text-white-50">
        {w}×{h}, {FORMATS[spec.format].hint}
      </p>
    </div>
  )
}

function Explore({
  data,
  locale,
  busy,
  onLocale,
  onEdit,
  onSelect,
  onPng,
  onExportAll,
}: {
  data: Dataset
  locale: Locale
  busy: string | null
  onLocale: (l: Locale) => void
  onEdit: (t: Template) => void
  onSelect: (id: string) => void
  onPng: (t: Template, s: ChartSpec) => void
  onExportAll: (f: FormatId) => void
}) {
  const [format, setFormat] = useState<FormatId>('landscape')
  const specs = useMemo(
    () => TEMPLATES.map((t) => applyTemplate(t, { ...DEFAULT_SPEC, format, locale })),
    [format, locale],
  )
  const sources = data.sources.filter((s) => s.ok && s.id !== 'manual')
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="mb-8">
        <h1 className="mb-3 text-3xl font-bold tracking-[-0.03em] md:text-5xl">
          el estado de los modelos de ia
        </h1>
        <p className="max-w-2xl text-white-80">
          inteligencia, coste, velocidad y benchmarks de{' '}
          {data.models.filter((m) => !m.family).length} modelos, cruzando{' '}
          {sources.map((s) => s.name.toLowerCase()).join(', ')}. pasa el ratón por cualquier punto o
          barra para ver el detalle y haz clic para abrir la ficha del modelo.
        </p>
      </div>

      <div className="sticky top-14 z-20 -mx-4 mb-10 border-b border-white-20 bg-bg px-4 py-3 md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="scrollbar-thin flex gap-1.5 overflow-x-auto">
            {TEMPLATES.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document
                    .getElementById(t.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="shrink-0 rounded-full border border-white-30 px-3 py-1 text-xs font-medium whitespace-nowrap text-white-80 hover:border-white hover:text-white"
              >
                {t.name[locale]}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Pills
              value={locale}
              options={[
                { value: 'es', label: 'es' },
                { value: 'en', label: 'en' },
              ]}
              onChange={onLocale}
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
              solid
              disabled={!!busy}
              onClick={() => onExportAll(format)}
              title="todas las gráficas en este formato, en es y en, png + csv"
            >
              {busy?.startsWith('templates') ? busy.replace('templates', 'zip') : 'exportar todo'}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-20">
        {TEMPLATES.map((t, i) => {
          const narrow = format === 'story' || format === 'portrait' || format === 'square'
          return (
            <section key={t.id} id={t.id} className="scroll-mt-32">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-xl font-bold tracking-[-0.03em]">{t.name[locale]}</h2>
                <div className="flex gap-2">
                  <Button onClick={() => onEdit(t)}>editar</Button>
                  <Button solid disabled={!!busy} onClick={() => onPng(t, specs[i])}>
                    {busy === `png-${t.id}` ? 'exportando...' : 'png'}
                  </Button>
                </div>
              </div>
              <div
                className={`overflow-hidden rounded-xl shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_30px_80px_-20px_rgba(0,40,60,0.35)] ${narrow ? 'mx-auto max-w-xl' : ''}`}
              >
                <InteractivePoster data={data} spec={specs[i]} onSelect={onSelect} />
              </div>
            </section>
          )
        })}
      </div>
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

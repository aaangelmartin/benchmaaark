// posters are svg, so export is: render to markup, embed the font, then
// rasterise on a canvas for png. one path for single files and batches.
import { strToU8, zipSync } from 'fflate'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import latinUrl from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url'
import latinExtUrl from '@fontsource-variable/outfit/files/outfit-latin-ext-wght-normal.woff2?url'
import { Poster } from '../charts/Poster.tsx'
import { type ChartSpec, FORMATS, resolve } from '../charts/spec.ts'
import type { Dataset } from './types.ts'

let fontCss: Promise<string> | null = null
let fontsWarm = false

async function toDataUrl(url: string): Promise<string> {
  const blob = await (await fetch(url)).blob()
  return new Promise((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = fail
    r.readAsDataURL(blob)
  })
}

function embeddedFont(): Promise<string> {
  fontCss ??= Promise.all([toDataUrl(latinUrl), toDataUrl(latinExtUrl)]).then(([a, b]) =>
    [a, b]
      .map(
        (src) =>
          `@font-face{font-family:Outfit;font-style:normal;font-weight:100 900;src:url(${src}) format("woff2")}`,
      )
      .join(''),
  )
  return fontCss
}

export async function posterSvg(data: Dataset, spec: ChartSpec): Promise<string> {
  const markup = renderToStaticMarkup(createElement(Poster, { data, spec }))
  const css = await embeddedFont()
  return markup.replace(/^<svg([^>]*)>/, `<svg$1><defs><style>${css}</style></defs>`)
}

export async function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.width = w
    img.height = h
    img.src = url
    await img.decode()
    // chrome can decode an svg image before its embedded @font-face is ready
    // and paint it with no text. the first export of a session hit this, so
    // give the font a moment to settle before drawing.
    await new Promise((ok) => setTimeout(ok, fontsWarm ? 30 : 250))
    fontsWarm = true
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w * scale, h * scale)
    return await new Promise((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error('png failed'))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function posterPng(data: Dataset, spec: ChartSpec, scale = 2): Promise<Blob> {
  const { w, h } = FORMATS[spec.format]
  return svgToPng(await posterSvg(data, spec), w, h, scale)
}

export function posterCsv(data: Dataset, spec: ChartSpec): string {
  const r = resolve(data, spec)
  const ids = [
    ...new Set([
      spec.y,
      ...(spec.type === 'scatter' ? [spec.x] : []),
      ...(spec.type === 'compare' || spec.type === 'table' ? spec.metrics : []),
    ]),
  ]
  const defs = ids.map((id) => r.metric(id)).filter((m) => !!m)
  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = ['model', 'lab', 'release_date', 'open_weights', ...defs.map((d) => d.id)]
  const rows = r.models.map((m) => [
    m.name,
    r.lab(m.lab),
    m.releaseDate,
    m.openWeights,
    ...defs.map((d) => m.values[d.id]),
  ])
  return [head, ...rows].map((row) => row.map(esc).join(',')).join('\n')
}

export function fileBase(spec: ChartSpec, name: string, date: string): string {
  return `${name}-${spec.format}-${spec.locale}-${date.slice(0, 10)}`
}

export function download(data: Blob | string, filename: string, type = 'application/octet-stream') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export async function copyPng(blob: Blob) {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export interface BatchItem {
  name: string
  spec: ChartSpec
}

export async function exportZip(
  data: Dataset,
  items: BatchItem[],
  opts: { png: boolean; svg: boolean; csv: boolean; scale: number },
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}
  let done = 0
  for (const it of items) {
    const base = fileBase(it.spec, it.name, data.generatedAt)
    const svg = await posterSvg(data, it.spec)
    if (opts.svg) files[`svg/${base}.svg`] = strToU8(svg)
    if (opts.png) {
      const { w, h } = FORMATS[it.spec.format]
      const png = await svgToPng(svg, w, h, opts.scale)
      files[`png/${base}.png`] = new Uint8Array(await png.arrayBuffer())
    }
    if (opts.csv) files[`csv/${it.name}-${it.spec.locale}.csv`] = strToU8(posterCsv(data, it.spec))
    onProgress?.(++done, items.length)
  }
  const credits = data.sources
    .filter((s) => s.ok)
    .map((s) => `- ${s.name} (${s.url}), ${s.license}, ${s.fetchedAt?.slice(0, 10) ?? '-'}`)
    .join('\n')
  files['SOURCES.txt'] = strToU8(
    `benchmaaark - aaangelmartin.com\ndata generated ${data.generatedAt}\n\n${credits}\n`,
  )
  return new Blob([zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>], {
    type: 'application/zip',
  })
}

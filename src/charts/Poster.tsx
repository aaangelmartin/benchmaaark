import { forwardRef } from 'react'
import aaaSvg from '../assets/aaa.svg?raw'
import wordSvg from '../assets/aaangelmartin.svg?raw'
import { formatDate } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { ellipsize, glyphBox, wrap } from '../lib/text.ts'
import type { Dataset, SourceId } from '../lib/types.ts'
import type { ChartProps } from './axes.tsx'
import { Bars } from './Bars.tsx'
import { Compare } from './Compare.tsx'
import { Scatter } from './Scatter.tsx'
import { autoTitle, type ChartSpec, FORMATS, requiredMetrics, resolve } from './spec.ts'
import { Table } from './Table.tsx'
import { BG, OPACITY, unit, white } from './theme.ts'
import { Timeline } from './Timeline.tsx'

const AAA = {
  w: Number(aaaSvg.match(/viewBox="0 0 ([\d.]+)/)?.[1] ?? 346),
  h: Number(aaaSvg.match(/viewBox="0 0 [\d.]+ ([\d.]+)/)?.[1] ?? 101),
  inner: aaaSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
}

// "aaangelmartin." from the site, one path per letter. the last path is the
// period, which the signature leaves out, so the box ends at the final "n".
const WORD = (() => {
  const inner = wordSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  const paths = inner.match(/<path[\s\S]*?\/>/g) ?? []
  return { inner: paths.slice(0, -1).join(''), w: 12320, h: 1888, baseline: 1474, xTop: 462 }
})()

const CHARTS: Record<ChartSpec['type'], (p: ChartProps) => React.ReactNode> = {
  scatter: Scatter,
  bars: Bars,
  timeline: Timeline,
  compare: Compare,
  table: Table,
}

export function usedSources(data: Dataset, spec: ChartSpec): SourceId[] {
  const ids = new Set([
    ...requiredMetrics(spec),
    ...(spec.type === 'compare' || spec.type === 'table' ? spec.metrics : []),
    spec.filter.rankBy ?? '',
  ])
  const out = new Set<SourceId>()
  for (const m of data.metrics) if (ids.has(m.id)) out.add(m.source)
  return [...out]
}

export const Poster = forwardRef<
  SVGSVGElement,
  { data: Dataset; spec: ChartSpec; className?: string }
>(function Poster({ data, spec, className }, ref) {
  const { w, h } = FORMATS[spec.format]
  const s = unit(w, h)
  const L = spec.locale
  const tx = (v: string) => (spec.options.lowercase ? v.toLowerCase() : v)
  const r = resolve(data, spec)
  const { title, subtitle } = autoTitle(spec, r)

  const pad = 72 * s
  const inner = w - pad * 2
  const titleSize = 52 * s
  const subSize = 23 * s
  const logoH = 30 * s
  const logoW = (AAA.w / AAA.h) * logoH
  // the title wraps before the aaa. mark in the top right corner
  const titleLines = wrap(tx(title), inner - logoW - 48 * s, titleSize, 700, -0.03).slice(0, 3)
  const subLines = subtitle
    ? wrap(tx(subtitle), Math.min(inner, 1100 * s), subSize, 500).slice(0, 3)
    : []

  const titleTop = pad + titleSize * 0.82
  const subTop = titleTop + (titleLines.length - 1) * titleSize * 1.05 + subSize * 1.7
  const headerBottom = subLines.length
    ? subTop + (subLines.length - 1) * subSize * 1.35 + subSize * 0.4
    : titleTop + titleSize * 0.25

  // signature: "@" + the aaangelmartin wordmark, bottom left. sources go right
  const sigH = 30 * s
  const sigW = (WORD.w / WORD.h) * sigH
  const sigBase = (WORD.baseline / WORD.h) * sigH
  // the @ is centred on the x-height band of the lowercase letters and drawn a
  // little taller than it, measured from the glyph's real ink box
  const xTop = (WORD.xTop / WORD.h) * sigH
  const xBand = sigBase - xTop
  const probe = glyphBox('@', 100, 600)
  const atSize = (xBand * 1.3 * 100) / (probe.ascent + probe.descent)
  const at = glyphBox('@', atSize, 600)
  const atGap = xBand * 0.08
  const atW = at.left + at.right + atGap
  const atY = xTop + xBand / 2 + (at.ascent - at.descent) / 2
  const footH = sigH + 18 * s
  const footY = h - pad * 0.75 - footH
  const chartTop = headerBottom + 44 * s
  const chartBox = { x: pad, y: chartTop, w: inner, h: footY - 36 * s - chartTop }

  const credits = usedSources(data, spec)
    .map((id) => data.sources.find((src) => src.id === id)?.credit)
    .filter(Boolean)
    .join(', ')
  const asOf = `${t('dataAsOf', L)} ${formatDate(data.generatedAt, L)}`
  const footSize = 15 * s
  const sourceText = credits ? `${t('sources', L)}: ${credits}. ${asOf}` : asOf

  const Chart = CHARTS[spec.type]
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={className}
      fontFamily="Outfit, sans-serif"
    >
      <rect width={w} height={h} fill={BG} />

      {titleLines.map((line, i) => (
        <text
          key={i}
          x={pad}
          y={titleTop + i * titleSize * 1.05}
          fontSize={titleSize}
          fontWeight={700}
          fill={white()}
          letterSpacing="-0.03em"
        >
          {line}
        </text>
      ))}
      {subLines.map((line, i) => (
        <text
          key={i}
          x={pad}
          y={subTop + i * subSize * 1.35}
          fontSize={subSize}
          fontWeight={500}
          fill={white(OPACITY.secondary)}
        >
          {line}
        </text>
      ))}

      <Chart r={r} box={chartBox} s={s} tx={tx} />

      <g
        transform={`translate(${w - pad - logoW} ${pad + titleSize * 0.82 - logoH}) scale(${logoH / AAA.h})`}
        dangerouslySetInnerHTML={{ __html: AAA.inner }}
      />

      <text
        x={pad + at.left}
        y={footY + 18 * s + atY}
        fontSize={atSize}
        fontWeight={600}
        fill={white()}
      >
        @
      </text>
      <g
        transform={`translate(${pad + atW} ${footY + 18 * s}) scale(${sigH / WORD.h})`}
        dangerouslySetInnerHTML={{ __html: WORD.inner }}
      />
      <text
        x={w - pad}
        y={footY + 18 * s + sigBase}
        fontSize={footSize}
        fontWeight={500}
        fill={white(OPACITY.muted)}
        textAnchor="end"
      >
        {ellipsize(tx(sourceText), inner - sigW - atW - 60 * s, footSize, 500)}
      </text>
    </svg>
  )
})

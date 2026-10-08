import { forwardRef } from 'react'
import { formatDate } from '../lib/format.ts'
import { t } from '../lib/i18n.ts'
import { ellipsize, glyphBox, measure, wrap } from '../lib/text.ts'
import type { Dataset, SourceId } from '../lib/types.ts'
import type { ChartProps } from './axes.tsx'
import { Bars } from './Bars.tsx'
import { Compare } from './Compare.tsx'
import { Scatter } from './Scatter.tsx'
import { autoTitle, type ChartSpec, FORMATS, requiredMetrics, resolve } from './spec.ts'
import { Table } from './Table.tsx'
import { BG, OPACITY, unit, white } from './theme.ts'
import { Timeline } from './Timeline.tsx'
import { BRAND } from '../lib/brand.ts'

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
  const MARK = BRAND.mark
  const logoW = (MARK.w / MARK.h) * logoH
  // the title wraps before the brand mark in the top right corner
  const titleLines = wrap(tx(title), inner - logoW - 48 * s, titleSize, 700, -0.03).slice(0, 3)
  const subLines = subtitle
    ? wrap(tx(subtitle), Math.min(inner, 1100 * s), subSize, 500).slice(0, 3)
    : []

  const titleTop = pad + titleSize * 0.82
  const subTop = titleTop + (titleLines.length - 1) * titleSize * 1.05 + subSize * 1.7
  const headerBottom = subLines.length
    ? subTop + (subLines.length - 1) * subSize * 1.35 + subSize * 0.4
    : titleTop + titleSize * 0.25

  // signature, bottom left: the brand's domain, as its drawn wordmark (which
  // ends in the dot) followed by "com" set to the same x-height. sources go right
  const WM = BRAND.wordmark
  const sigH = 30 * s
  const sigBase = sigH * 0.8
  const xBand = 17 * s
  const wmScale = xBand / (WM.baseline - WM.xTop)
  const wmW = WM.w * wmScale
  const probe = glyphBox('o', 100, 700)
  const comSize = (xBand * 100) / (probe.ascent + probe.descent)
  const com = glyphBox('com', comSize, 700)
  const comX = pad + wmW + xBand * 0.09
  const sigW = comX - pad + measure('com', comSize, 700, -0.03)
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
        transform={`translate(${w - pad - logoW} ${pad + titleSize * 0.82 - logoH}) scale(${logoH / MARK.h})`}
        dangerouslySetInnerHTML={{ __html: MARK.inner }}
      />

      <g
        transform={`translate(${pad} ${footY + 18 * s + sigBase - WM.baseline * wmScale}) scale(${wmScale})`}
        dangerouslySetInnerHTML={{ __html: WM.inner }}
      />
      <text
        x={comX - com.left}
        y={footY + 18 * s + sigBase - com.descent}
        fontSize={comSize}
        fontWeight={700}
        fill={white()}
        letterSpacing="-0.03em"
      >
        com
      </text>
      <text
        x={w - pad}
        y={footY + 18 * s + sigBase}
        fontSize={footSize}
        fontWeight={500}
        fill={white(OPACITY.muted)}
        textAnchor="end"
      >
        {ellipsize(tx(sourceText), inner - sigW - 60 * s, footSize, 500)}
      </text>
    </svg>
  )
})

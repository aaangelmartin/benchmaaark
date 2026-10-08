// the same poster that gets exported, plus hover and click. charts tag every
// model element with data-id, so one listener on the svg is enough.
import { useId, useMemo, useRef, useState } from 'react'
import { Poster } from '../charts/Poster.tsx'
import { type ChartSpec, requiredMetrics } from '../charts/spec.ts'
import { formatDate, formatValue } from '../lib/format.ts'
import type { Dataset, MetricDef } from '../lib/types.ts'

const KEY_METRICS = [
  'eci',
  'aa-intelligence',
  'arena-text',
  'cursorbench',
  'cursorbench-cost',
  'aa-speed',
]

export function InteractivePoster({
  data,
  spec,
  onSelect,
  className,
}: {
  data: Dataset
  spec: ChartSpec
  onSelect?: (id: string) => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [hover, setHover] = useState<{ id: string; x: number; y: number; w: number } | null>(null)

  const onMove = (e: React.MouseEvent) => {
    const el = (e.target as Element).closest('[data-id]')
    const box = ref.current?.getBoundingClientRect()
    if (!el || !box) return setHover(null)
    setHover({
      id: el.getAttribute('data-id')!,
      x: e.clientX - box.left,
      y: e.clientY - box.top,
      w: box.width,
    })
  }

  return (
    <div
      ref={ref}
      className={`ip-${uid} relative ${className ?? ''}`}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const id = (e.target as Element).closest('[data-id]')?.getAttribute('data-id')
        if (id && onSelect) onSelect(id)
      }}
    >
      <style>{`
        .ip-${uid} [data-id] { cursor: pointer; transition: opacity 200ms; }
        ${hover ? `.ip-${uid} [data-id]:not([data-id="${CSS.escape(hover.id)}"]) { opacity: .4 }` : ''}
      `}</style>
      <Poster data={data} spec={spec} className="block h-auto w-full" />
      {hover && <Tooltip data={data} spec={spec} {...hover} />}
    </div>
  )
}

function Tooltip({
  data,
  spec,
  id,
  x,
  y,
  w,
}: {
  data: Dataset
  spec: ChartSpec
  id: string
  x: number
  y: number
  w: number
}) {
  const m = data.models.find((mm) => mm.id === id)
  const metrics = useMemo(() => new Map(data.metrics.map((d) => [d.id, d])), [data])
  if (!m) return null
  const L = spec.locale
  const main = [
    ...new Set([
      ...requiredMetrics(spec),
      ...(spec.type === 'compare' || spec.type === 'table' ? spec.metrics : []),
    ]),
  ]
  const extra = KEY_METRICS.filter((k) => !main.includes(k))
  const row = (k: string, strong: boolean) => {
    const d = metrics.get(k) as MetricDef | undefined
    const v = m.values[k]
    if (!d || v === undefined) return null
    return (
      <div key={k} className="flex justify-between gap-6">
        <span className={strong ? 'font-semibold' : 'opacity-70'}>{d.short[L]}</span>
        <span className={strong ? 'font-bold' : 'font-semibold'}>{formatValue(v, d.unit)}</span>
      </div>
    )
  }
  const lab = data.labs.find((l) => l.id === m.lab)?.name ?? m.lab
  const left = x > w * 0.6
  return (
    <div
      className="pointer-events-none absolute z-30 w-64 rounded-xl bg-white p-4 text-sm text-bg shadow-[0_20px_50px_-15px_rgba(0,40,60,0.45)]"
      style={{ left: left ? x - 272 : x + 16, top: Math.max(8, y - 20) }}
    >
      <p className="text-base leading-tight font-bold lowercase">{m.name}</p>
      <p className="mb-3 text-xs lowercase opacity-70">
        {[
          lab,
          m.releaseDate ? formatDate(m.releaseDate, L) : null,
          m.openWeights === true
            ? L === 'es'
              ? 'pesos abiertos'
              : 'open weights'
            : m.openWeights === false
              ? L === 'es'
                ? 'cerrado'
                : 'closed'
              : null,
        ]
          .filter(Boolean)
          .join(', ')}
      </p>
      <div className="space-y-1 lowercase">
        {main.map((k) => row(k, true))}
        {extra.some((k) => m.values[k] !== undefined) && (
          <div className="my-2 border-t border-bg/20" />
        )}
        {extra.map((k) => row(k, false))}
      </div>
      <p className="mt-3 text-xs lowercase opacity-60">
        {Object.keys(m.values).length}{' '}
        {L === 'es' ? 'métricas. clic para ver la ficha' : 'metrics. click for details'}
      </p>
    </div>
  )
}

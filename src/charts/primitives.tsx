import type { ReactNode } from 'react'
import { FONT, type Shape, textTint, tint } from './theme.ts'

export function Marker({ id, ...props }: MarkerProps & { id?: string }) {
  if (!id) return <Shape {...props} />
  return (
    <g data-id={id}>
      <circle cx={props.x} cy={props.y} r={props.r * 2.2} fill="transparent" />
      <Shape {...props} />
    </g>
  )
}

interface MarkerProps {
  // overrides the white tint, for interface icons drawn in the brand's cyan
  color?: string
  shape: Shape
  x: number
  y: number
  r: number
  opacity?: number
  filled?: boolean
}

function Shape({ shape, x, y, r, opacity = 1, filled = true, color }: MarkerProps) {
  const sw = Math.max(1.5, r * 0.35)
  const paint = filled
    ? { fill: color ?? tint(opacity), stroke: 'none' }
    : { fill: 'none', stroke: color ?? tint(opacity), strokeWidth: sw }
  switch (shape) {
    case 'circle':
      return <circle cx={x} cy={y} r={r} {...paint} />
    case 'ring':
      return (
        <circle
          cx={x}
          cy={y}
          r={r * 0.85}
          fill="none"
          stroke={color ?? tint(opacity)}
          strokeWidth={sw}
        />
      )
    case 'square':
      return (
        <rect
          x={x - r * 0.88}
          y={y - r * 0.88}
          width={r * 1.76}
          height={r * 1.76}
          rx={r * 0.2}
          {...paint}
        />
      )
    case 'triangle': {
      const h = r * 1.15
      return (
        <path
          d={`M${x},${y - h} L${x + h},${y + h * 0.8} L${x - h},${y + h * 0.8} Z`}
          strokeLinejoin="round"
          {...paint}
        />
      )
    }
    case 'diamond': {
      const h = r * 1.2
      return <path d={`M${x},${y - h} L${x + h},${y} L${x},${y + h} L${x - h},${y} Z`} {...paint} />
    }
    case 'cross': {
      const h = r * 0.95
      return (
        <path
          d={`M${x - h},${y - h} L${x + h},${y + h} M${x + h},${y - h} L${x - h},${y + h}`}
          stroke={color ?? tint(opacity)}
          strokeWidth={sw * 1.4}
          strokeLinecap="round"
        />
      )
    }
  }
}

export function Label({
  x,
  y,
  size,
  weight = 500,
  opacity = 1,
  anchor = 'start',
  baseline = 'middle',
  tracking = 0,
  children,
}: {
  x: number
  y: number
  size: number
  weight?: number
  opacity?: number
  anchor?: 'start' | 'middle' | 'end'
  baseline?: 'middle' | 'hanging' | 'alphabetic' | 'central'
  tracking?: number
  children: ReactNode
}) {
  // dominant-baseline is unreliable once rasterised, so "middle" is done by hand
  const dy =
    baseline === 'middle' || baseline === 'central'
      ? size * 0.35
      : baseline === 'hanging'
        ? size * 0.78
        : 0
  return (
    <text
      x={x}
      y={y + dy}
      fontFamily={FONT}
      fontSize={size}
      fontWeight={weight}
      fill={textTint(opacity)}
      textAnchor={anchor}
      letterSpacing={tracking ? `${tracking}em` : undefined}
    >
      {children}
    </text>
  )
}

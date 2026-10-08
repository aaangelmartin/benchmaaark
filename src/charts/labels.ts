// greedy point-label placement: try a few spots around each point in priority
// order and keep the first that collides with nothing already placed.
import { measure } from '../lib/text.ts'
import type { Box } from './theme.ts'

export interface LabelRequest {
  id: string
  text: string
  x: number
  y: number
  r: number // marker radius
  priority: number // higher first
  force?: boolean // highlighted models always get a label if any spot exists
}

export interface PlacedLabel {
  id: string
  text: string
  x: number
  y: number
  anchor: 'start' | 'end' | 'middle'
  // leader line from the point, when the label had to move away
  leader?: { x1: number; y1: number; x2: number; y2: number }
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export function placeLabels(
  reqs: LabelRequest[],
  bounds: Box,
  size: number,
  weight: number,
  obstacles: Box[] = [],
  limit = Infinity,
): PlacedLabel[] {
  const taken: Box[] = [...obstacles]
  for (const r of reqs) taken.push({ x: r.x - r.r, y: r.y - r.r, w: r.r * 2, h: r.r * 2 })
  const placed: PlacedLabel[] = []
  const h = size * 1.15
  const sorted = [...reqs].sort((a, b) => b.priority - a.priority)

  for (const r of sorted) {
    if (placed.length >= limit && !r.force) continue
    const w = measure(r.text, size, weight)
    const gap = r.r + size * 0.35
    const far = gap + size * 1.4
    const spots: Array<[number, number, PlacedLabel['anchor'], boolean]> = [
      [r.x + gap, r.y, 'start', false],
      [r.x - gap, r.y, 'end', false],
      [r.x, r.y - gap - h * 0.45, 'middle', false],
      [r.x, r.y + gap + h * 0.45, 'middle', false],
      [r.x + gap * 0.8, r.y - gap * 0.9, 'start', false],
      [r.x - gap * 0.8, r.y - gap * 0.9, 'end', false],
      [r.x + gap * 0.8, r.y + gap * 0.9, 'start', false],
      [r.x - gap * 0.8, r.y + gap * 0.9, 'end', false],
      [r.x + far, r.y - far * 0.6, 'start', true],
      [r.x - far, r.y - far * 0.6, 'end', true],
      [r.x + far, r.y + far * 0.6, 'start', true],
      [r.x - far, r.y + far * 0.6, 'end', true],
    ]
    for (const [x, y, anchor, leader] of spots) {
      if (leader && !r.force) break
      const bx = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2
      const box = { x: bx - 2, y: y - h / 2, w: w + 4, h }
      if (
        box.x < bounds.x ||
        box.y < bounds.y ||
        box.x + box.w > bounds.x + bounds.w ||
        box.y + box.h > bounds.y + bounds.h
      )
        continue
      if (taken.some((t) => overlaps(t, box))) continue
      taken.push(box)
      placed.push({
        id: r.id,
        text: r.text,
        x,
        y,
        anchor,
        leader: leader
          ? { x1: r.x, y1: r.y, x2: anchor === 'start' ? x - size * 0.2 : x + size * 0.2, y2: y }
          : undefined,
      })
      break
    }
  }
  return placed
}

// turns a polyline into small boxes so labels avoid sitting on top of it
export function lineObstacles(points: Array<[number, number]>, thickness: number): Box[] {
  const out: Box[] = []
  const step = thickness * 1.5
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step))
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n
      const y = y0 + ((y1 - y0) * k) / n
      out.push({ x: x - thickness / 2, y: y - thickness / 2, w: thickness, h: thickness })
    }
  }
  return out
}

// stacks end-of-line labels so they never overlap, keeping them close to their line
export function spreadVertically<T extends { y: number }>(
  items: T[],
  minGap: number,
  top: number,
  bottom: number,
): T[] {
  const sorted = [...items].sort((a, b) => a.y - b.y)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].y - sorted[i - 1].y < minGap) sorted[i].y = sorted[i - 1].y + minGap
  }
  const overflow = sorted.length ? sorted[sorted.length - 1].y - bottom : 0
  if (overflow > 0) {
    sorted[sorted.length - 1].y -= overflow
    for (let i = sorted.length - 2; i >= 0; i--) {
      if (sorted[i + 1].y - sorted[i].y < minGap) sorted[i].y = sorted[i + 1].y - minGap
    }
  }
  if (sorted.length && sorted[0].y < top) {
    const shift = top - sorted[0].y
    for (const s of sorted) s.y += shift
  }
  return sorted
}

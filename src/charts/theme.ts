import { BRAND } from '../lib/brand.ts'

// the canvas is the brand's colour (cyan for aaa., black for laaabs.) and
// everything on it is white at
// some opacity. no other colours, no gradients. series are told apart with
// opacity, dash patterns, marker shapes and direct labels.

export const BG = BRAND.bg
const [R, G, B] = [1, 3, 5].map((i) => parseInt(BRAND.bg.slice(i, i + 2), 16))

// white laid over the canvas at a given strength, as a solid colour. looks like
// white at that opacity but hides whatever is behind it
export function tint(a = 1): string {
  const t = Math.max(0, Math.min(1, a))
  const mix = (c: number) => Math.round(c + (255 - c) * t)
  return `rgb(${mix(R)},${mix(G)},${mix(B)})`
}

export const white = (a = 1) => (a >= 1 ? '#ffffff' : `rgba(255,255,255,${a})`)

export const OPACITY = {
  primary: 1,
  secondary: 0.8,
  muted: 0.5,
  faint: 0.3,
  border: 0.2,
  surface: 0.1,
} as const

export const FONT = 'Outfit, sans-serif'

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

// type and spacing scale with the short side, so a 1080 square and a
// 1600x900 landscape read the same once the platform shrinks them
export function unit(w: number, h: number): number {
  return Math.min(w, h) / 900
}

export const DASHES = ['', '12 8', '3 7', '18 7 3 7', '6 5', '24 8']
export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'cross', 'ring'] as const
export type Shape = (typeof SHAPES)[number]

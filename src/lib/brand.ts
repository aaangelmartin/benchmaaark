// two editions of the same site, one per brand. the entry html sets
// <html data-brand>, so a page is one brand for its whole life.
//
//   aaa      aaangelmartin.com/brand: the cyan is the canvas, white on top
//   laaabs   laaabs.: black canvas, white on top, cyan only as a signal (the
//            dot of the wordmark). never a cyan background.
import aaaSvg from '../assets/aaa.svg?raw'
import laaabsSvg from '../assets/laaabs.svg?raw'

export type BrandId = 'aaa' | 'laaabs'

interface Vector {
  inner: string
  w: number
  h: number
}

export interface Brand {
  id: BrandId
  name: string
  bg: string
  signal: string // the one accent, for small marks only
  // top right of every poster
  mark: Vector
  // bottom left of every poster: the domain, never a social handle
  domain: string
  home: string
}

function vector(svg: string): Vector {
  const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) ?? []
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return { inner, w: Number(w), h: Number(h) }
}

const BRANDS: Record<BrandId, Brand> = {
  aaa: {
    id: 'aaa',
    name: 'aaa.',
    bg: '#00b5e2',
    signal: '#ffffff',
    mark: vector(aaaSvg),
    domain: 'aaangelmartin.com',
    home: 'https://aaangelmartin.com',
  },
  laaabs: {
    id: 'laaabs',
    name: 'laaabs.',
    bg: '#0a0a0a',
    signal: '#00b5e2',
    mark: vector(laaabsSvg),
    domain: 'laaabs.com',
    home: 'https://laaabs.com',
  },
}

const id = (
  typeof document !== 'undefined' ? document.documentElement.dataset.brand : undefined
) as BrandId | undefined
export const BRAND: Brand = BRANDS[id && id in BRANDS ? id : 'aaa']

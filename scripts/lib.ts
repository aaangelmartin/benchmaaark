import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Model, SourceId } from '../src/lib/types.ts'

export const ROOT = join(import.meta.dirname, '..')
export const RAW_DIR = join(ROOT, 'data', 'raw')

export interface Fetched {
  body: Buffer
  fetchedAt: string
  fromCache: boolean
}

// downloads into data/raw/<file>. when the network or the source fails, the
// last good copy is used so a flaky source never wipes a chart.
export async function fetchCached(
  url: string,
  file: string,
  init: RequestInit = {},
): Promise<Fetched> {
  const path = join(RAW_DIR, file)
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const body = Buffer.from(await res.arrayBuffer())
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
    await writeFile(
      `${path}.meta.json`,
      JSON.stringify({ url, fetchedAt: new Date().toISOString() }),
    )
    return { body, fetchedAt: new Date().toISOString(), fromCache: false }
  } catch (err) {
    try {
      const body = await readFile(path)
      const meta = JSON.parse(await readFile(`${path}.meta.json`, 'utf8'))
      warn(`${url} failed (${(err as Error).message}), using cache from ${meta.fetchedAt}`)
      return { body, fetchedAt: meta.fetchedAt, fromCache: true }
    } catch {
      throw err
    }
  }
}

export async function fetchJson<T>(url: string, file: string, init?: RequestInit) {
  const r = await fetchCached(url, file, init)
  return { ...r, json: JSON.parse(r.body.toString('utf8')) as T }
}

// what a source adapter hands back: raw rows, not yet merged into models
export interface SourceRow {
  source: SourceId
  rawId: string // the source's own identifier, used for aliases
  name: string
  lab?: string | null
  releaseDate?: string | null
  openWeights?: boolean | null
  values: Record<string, number>
  // epoch already groups versions into models; when it does, this is the group
  group?: string
}

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function isoDate(v: unknown): string | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = typeof v === 'number' ? new Date(v * 1000) : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function setMax(values: Record<string, number>, metric: string, v: number | null) {
  if (v === null) return
  if (values[metric] === undefined || v > values[metric]) values[metric] = v
}

export function setMin(values: Record<string, number>, metric: string, v: number | null) {
  if (v === null) return
  if (values[metric] === undefined || v < values[metric]) values[metric] = v
}

export const log = (...a: unknown[]) => console.log('  ', ...a)
export const warn = (...a: unknown[]) => console.warn('  ! ', ...a)

export type { Model }

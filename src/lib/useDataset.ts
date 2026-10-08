import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dataset } from './types.ts'

export interface DataStatus {
  updatedAt: string | null
  running: boolean
  lastRun: { at: string; ok: boolean } | null
  maxAgeHours: number
  hasAaKey: boolean
}

const url = (bust = '') => `${import.meta.env.BASE_URL}data/dataset.json${bust}`

// loads the dataset and, under `pnpm dev`, reloads it whenever the background
// refresh rewrites the file. the static build has no /api, so it just loads once.
export function useDataset() {
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<DataStatus | null>(null)
  const seen = useRef<string | null>(null)

  const load = useCallback(async (bust = '') => {
    try {
      const r = await fetch(url(bust))
      if (!r.ok) throw new Error(String(r.status))
      setData(await r.json())
      setError(null)
    } catch {
      setError('todavía no hay datos. se están descargando, espera un momento.')
    }
  }, [])

  const poll = useCallback(async () => {
    // the refresh api only exists under `pnpm dev`
    if (!import.meta.env.DEV) return
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}api/status`)
      if (!r.ok || !r.headers.get('content-type')?.includes('json')) return
      const s: DataStatus = await r.json()
      setStatus(s)
      if (s.updatedAt && seen.current && s.updatedAt !== seen.current)
        void load(`?t=${Date.parse(s.updatedAt)}`)
      if (s.updatedAt) seen.current = s.updatedAt
    } catch {
      // static build, no api
    }
  }, [load])

  useEffect(() => {
    void load()
    void poll()
    const t = setInterval(() => void poll(), 5_000)
    return () => clearInterval(t)
  }, [load, poll])

  const refresh = useCallback(async () => {
    await fetch(`${import.meta.env.BASE_URL}api/refresh`, { method: 'POST' })
    void poll()
  }, [poll])

  // a failed first load (no dataset yet) retries once the refresh writes it
  useEffect(() => {
    if (error && status?.updatedAt) void load(`?t=${Date.parse(status.updatedAt)}`)
  }, [error, status?.updatedAt, load])

  return { data, error, status, refresh }
}

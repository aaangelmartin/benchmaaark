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

// loads the dataset and keeps it fresh on its own, with no button:
//   under `pnpm dev` the vite plugin rebuilds it when it gets old, and this
//   reloads it the moment the file changes
//   on the published site the deploy rebuilds it every 6 hours, and this
//   re-reads the file every few minutes and swaps it in when it is newer
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
      // a flag, not a message: the app words it in the current language
      setError('no-data')
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

  // published site: pick up a newer dataset without a page reload
  useEffect(() => {
    if (import.meta.env.DEV) return
    const t = setInterval(async () => {
      try {
        const r = await fetch(url(`?t=${Date.now()}`), { cache: 'no-store' })
        if (!r.ok) return
        const next: Dataset = await r.json()
        setData((cur) => (cur && cur.generatedAt === next.generatedAt ? cur : next))
      } catch {
        // offline or mid-deploy: keep what we have
      }
    }, 10 * 60_000)
    return () => clearInterval(t)
  }, [])

  // a failed first load (no dataset yet) retries once the refresh writes it
  useEffect(() => {
    if (error && status?.updatedAt) void load(`?t=${Date.parse(status.updatedAt)}`)
  }, [error, status?.updatedAt, load])

  return { data, error, status }
}

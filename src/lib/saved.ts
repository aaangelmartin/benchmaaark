// charts you build are kept in this browser, nothing is sent anywhere
import type { ChartSpec } from '../charts/spec.ts'

export interface SavedChart {
  id: string
  name: string
  spec: ChartSpec
  savedAt: string
}

const KEY = 'benchmaaark:charts'

export function loadSaved(): SavedChart[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function store(list: SavedChart[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // private mode or a full disk: the chart still works, it just is not kept
  }
}

export function upsertSaved(chart: SavedChart): SavedChart[] {
  const list = [chart, ...loadSaved().filter((c) => c.id !== chart.id)]
  store(list)
  return list
}

export function removeSaved(id: string): SavedChart[] {
  const list = loadSaved().filter((c) => c.id !== id)
  store(list)
  return list
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

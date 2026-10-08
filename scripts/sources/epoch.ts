// epoch ai: capabilities index (eci) plus every benchmark in their hub.
// https://epoch.ai/benchmarks - cc-by 4.0
import { unzipSync, strFromU8 } from 'fflate'
import Papa from 'papaparse'
import { slugify } from '../../src/lib/match.ts'
import type { MetricDef, MetricUnit, SourceMeta } from '../../src/lib/types.ts'
import { fetchCached, isoDate, log, num, setMax, type SourceRow } from '../lib.ts'

const ZIP_URL = 'https://epoch.ai/data/benchmark_data.zip'

type Row = Record<string, string>

// benchmarks the metadata file lists without a score column, picked by hand
// webdev arena is left out: lmarena publishes it directly
const EXTRAS: Array<{
  benchmark: string
  file: string
  column: string
  scale?: number
  unit?: MetricUnit
  log?: boolean
}> = [
  { benchmark: 'CursorBench', file: 'cursorbench_external.csv', column: 'Score' },
  { benchmark: 'CritPt', file: 'critpt_external.csv', column: 'Accuracy' },
  { benchmark: 'GDP.pdf', file: 'gdp_pdf_external.csv', column: 'GDP.pdf score' },
  { benchmark: 'SciCode', file: 'scicode_external.csv', column: 'Score' },
  {
    benchmark: 'LiveBench',
    file: 'live_bench_external.csv',
    column: 'Global average',
    scale: 0.01,
  },
  { benchmark: 'WeirdML v3', file: 'weirdml_v3_external.csv', column: 'Score' },
  { benchmark: 'EnigmaEval', file: 'enigma_eval_external.csv', column: 'Accuracy' },
  { benchmark: 'Blueprint-Bench 2', file: 'blueprint_bench_2_external.csv', column: 'Score' },
  { benchmark: 'VideoMME', file: 'video_mme_external.csv', column: 'Overall (no subtitles)' },
  {
    benchmark: 'Vending-Bench 2',
    file: 'vending_bench_2_external.csv',
    column: 'Score',
    unit: 'index',
  },
  { benchmark: 'ALE-Bench', file: 'ale_bench_external.csv', column: 'Performance', unit: 'index' },
]

// cost per task or run, recorded next to the score of the same run
const COSTS: Record<string, string> = {
  'ARC-AGI-2': 'Cost per task',
  'ARC-AGI': 'Cost per task',
  CursorBench: 'Cost per task',
  DeepSWE: 'Mean cost (USD)',
  FrontierSWE: 'Average cost (USD)',
  ProofBench: 'Cost per test (USD)',
  WeirdML: 'Cost per run',
  'WeirdML v3': 'Cost per run',
  'ALE-Bench': 'Cost',
}

// benchmarks that read better under a short, familiar name
const SHORT: Record<string, string> = {
  'SWE-Bench verified': 'SWE-bench Verified',
  'GPQA diamond': 'GPQA Diamond',
  'FrontierMath-Tiers-1-3-v2-Private': 'FrontierMath T1-3',
  'FrontierMath-Tier-4-v2-Private': 'FrontierMath T4',
  'FrontierMath-2025-02-28-Private': 'FrontierMath (2025)',
  'FrontierMath-Tier-4-2025-07-01-Private': 'FrontierMath T4 (2025)',
  'OTIS Mock AIME 2024-2025': 'OTIS AIME',
  HLE: "Humanity's Last Exam",
  'Remote Labor Index': 'Remote Labor Index',
}

function parse(files: Record<string, Uint8Array>, name: string): Row[] {
  const key = Object.keys(files).find((k) => k.endsWith(`/${name}`) || k === name)
  if (!key) return []
  return Papa.parse<Row>(strFromU8(files[key]), { header: true, skipEmptyLines: true }).data
}

function openWeights(group: string | undefined): boolean | null {
  if (group === 'Open weights') return true
  if (group === 'Closed weights') return false
  return null
}

export async function epoch() {
  const { body, fetchedAt } = await fetchCached(ZIP_URL, 'epoch/benchmark_data.zip')
  const files = unzipSync(new Uint8Array(body))

  const metrics: MetricDef[] = [
    {
      id: 'eci',
      label: { es: 'Índice de capacidades de Epoch (ECI)', en: 'Epoch Capabilities Index (ECI)' },
      short: { es: 'ECI', en: 'ECI' },
      unit: 'index',
      category: 'intelligence',
      source: 'epoch',
      higherIsBetter: true,
      description: {
        es: 'combina decenas de benchmarks en una única escala. 130 = claude 3.5 sonnet, 150 = gpt-5.',
        en: 'combines dozens of benchmarks into a single scale. 130 = claude 3.5 sonnet, 150 = gpt-5.',
      },
    },
    {
      id: 'metr-horizon',
      label: { es: 'Horizonte temporal METR (50%)', en: 'METR time horizon (50%)' },
      short: { es: 'horizonte METR', en: 'METR horizon' },
      unit: 'minutes',
      category: 'benchmark',
      source: 'epoch',
      higherIsBetter: true,
      log: true,
      description: {
        es: 'duración de las tareas de software que el modelo completa con un 50% de éxito.',
        en: 'length of software tasks the model completes with 50% success.',
      },
    },
  ]
  const rows: SourceRow[] = []

  // version -> model group, so "gpt-6-astra_max" lands on "GPT-6 Astra"
  const groupOf = new Map<string, string>()
  for (const r of parse(files, 'processed_data_for_eci.csv')) {
    if (r.model_version && r.Model) groupOf.set(r.model_version, r.Model)
  }

  for (const r of parse(files, 'eci_scores.csv')) {
    const eci = num(r.eci)
    if (eci === null) continue
    for (const v of (r.model_versions ?? '').split(/[,;]/))
      if (v.trim()) groupOf.set(v.trim(), r.Model)
    rows.push({
      source: 'epoch',
      rawId: r.Model,
      group: r.Model,
      name: r['Display name'] || r.Model,
      lab: r.Organization,
      releaseDate: isoDate(r.date),
      openWeights: openWeights(r['Accessibility group']),
      values: { eci },
    })
  }

  const benchmarks: Array<{
    benchmark: string
    file: string
    column: string
    scale: number
    unit: MetricUnit
    log?: boolean
  }> = []
  for (const m of parse(files, 'benchmark_metadata.csv')) {
    if (!m.source_file || !m.score_column) continue
    if (m.benchmark === 'METR Time Horizons') continue // handled as minutes below
    benchmarks.push({
      benchmark: m.benchmark,
      file: m.source_file,
      column: m.score_column,
      scale: num(m.scale) ?? 1,
      unit: 'fraction',
    })
  }
  for (const e of EXTRAS) {
    if (benchmarks.some((b) => b.benchmark === e.benchmark)) continue
    benchmarks.push({ scale: 1, unit: 'fraction', ...e })
  }
  benchmarks.push({
    benchmark: 'METR Time Horizons',
    file: 'metr_time_horizons_external.csv',
    column: 'Time horizon',
    scale: 1,
    unit: 'minutes',
  })

  for (const b of benchmarks) {
    const id =
      b.benchmark === 'METR Time Horizons' ? 'metr-horizon' : `epoch-${slugify(b.benchmark)}`
    const data = parse(files, b.file)
    if (!data.length) continue
    for (const r of data) {
      const raw = num(r[b.column])
      const version = r['Model version']
      if (raw === null || !version) continue
      const values: Record<string, number> = {}
      setMax(values, id, raw * b.scale)
      const cost = COSTS[b.benchmark] ? num(r[COSTS[b.benchmark]]) : null
      if (cost !== null && cost > 0) values[`${id}-cost`] = cost
      rows.push({
        source: 'epoch',
        rawId: version,
        group: groupOf.get(version),
        name: r.Name || version,
        lab: r.Organization,
        releaseDate: isoDate(r['Release date']),
        values,
      })
    }
    if (id === 'metr-horizon') continue
    const name = SHORT[b.benchmark] ?? b.benchmark
    metrics.push({
      id,
      label: { es: name, en: name },
      short: { es: name, en: name },
      unit: b.unit,
      category: b.unit === 'elo' ? 'arena' : 'benchmark',
      source: 'epoch',
      higherIsBetter: true,
      log: b.log,
    })
    if (COSTS[b.benchmark])
      metrics.push({
        id: `${id}-cost`,
        label: { es: `Coste por tarea en ${name}`, en: `Cost per task on ${name}` },
        short: { es: `coste ${name}`, en: `${name} cost` },
        unit: 'usd',
        category: 'cost',
        source: 'epoch',
        higherIsBetter: false,
        log: true,
        pairedWith: id,
      })
  }

  log(`epoch: ${rows.length} rows, ${metrics.length} metrics`)
  const meta: SourceMeta = {
    id: 'epoch',
    name: 'Epoch AI',
    url: 'https://epoch.ai/benchmarks',
    license: 'CC BY 4.0',
    credit: 'epoch ai (cc-by)',
    fetchedAt,
    ok: true,
  }
  return { meta, metrics, rows }
}

// fetches every source, matches models across them and writes
// public/data/dataset.json, the only file the app reads.
//
//   pnpm data            fetch everything (falls back to data/raw on failure)
//
// matching problems show up in data/raw/match-report.json. fix them with
// "aliases" in data/manual.json.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { effortOf } from '../src/lib/effort.ts'
import { labId, labName } from '../src/lib/labs.ts'
import { looseKeys, matchKey, slugify, stripVariant } from '../src/lib/match.ts'
import type { Dataset, MetricDef, Model, SourceId, SourceMeta } from '../src/lib/types.ts'
import { log, RAW_DIR, ROOT, type SourceRow, warn } from './lib.ts'
import { artificialAnalysis } from './sources/artificialanalysis.ts'
import { cursorbench } from './sources/cursorbench.ts'
import { epoch } from './sources/epoch.ts'
import { lmarena } from './sources/lmarena.ts'
import { openrouter } from './sources/openrouter.ts'

interface Manual {
  aliases: Record<string, string>
  ignore: string[]
  metrics: MetricDef[]
  models: Array<Omit<Model, 'refs' | 'lab'> & { lab: string; source?: string }>
}

// sources that may introduce a model. openrouter lists hundreds of fine-tunes
// and routers, so it only attaches prices to models someone actually measured.
const CREATES: SourceId[] = ['epoch', 'cursor', 'aa', 'lmarena', 'manual']

// openrouter may still introduce a model when a major lab just released it and
// nobody has benchmarked it yet (a new haiku shows up with price and context)
const MAJOR_LABS = new Set([
  'openai',
  'anthropic',
  'google',
  'xai',
  'deepseek',
  'alibaba',
  'mistral',
  'moonshot',
  'zai',
  'minimax',
  'meta',
  'amazon',
  'microsoft',
  'nvidia',
  'xiaomi',
  'bytedance',
])
const NOT_A_MODEL =
  /^~|:batch$|image|audio|tts|embed|guard|safeguard|lyria|veo|sora|banana|search|realtime|transcribe|moderation|latest/

function openrouterMayCreate(r: SourceRow): boolean {
  if (r.source !== 'openrouter' || NOT_A_MODEL.test(r.rawId)) return false
  if (!MAJOR_LABS.has(labId(r.lab))) return false
  const since = new Date()
  since.setUTCMonth(since.getUTCMonth() - 12)
  return !!r.releaseDate && r.releaseDate >= since.toISOString().slice(0, 10)
}

// earlier sources win for names and release dates
const ORDER: SourceId[] = ['epoch', 'aa', 'cursor', 'manual', 'lmarena', 'openrouter']

async function loadManual(): Promise<Manual> {
  const raw = JSON.parse(await readFile(join(ROOT, 'data', 'manual.json'), 'utf8'))
  return { aliases: {}, ignore: [], metrics: [], models: [], ...raw }
}

async function main() {
  const manual = await loadManual()
  console.log('fetching sources')

  const adapters: Array<
    [SourceId, () => Promise<{ meta: SourceMeta; metrics: MetricDef[]; rows: SourceRow[] }>]
  > = [
    ['epoch', epoch],
    ['cursor', cursorbench],
    ['aa', artificialAnalysis],
    ['lmarena', lmarena],
    ['openrouter', openrouter],
  ]
  const results = await Promise.all(
    adapters.map(async ([id, run]) => {
      try {
        return await run()
      } catch (err) {
        warn(`${id} failed: ${(err as Error).message}`)
        return null
      }
    }),
  )

  const sources: SourceMeta[] = []
  const metrics = new Map<string, MetricDef>()
  const rows: SourceRow[] = []
  for (const r of results) {
    if (!r) continue
    sources.push(r.meta)
    for (const m of r.metrics) metrics.set(m.id, m)
    rows.push(...r.rows)
  }
  for (const m of manual.metrics) metrics.set(m.id, m)
  for (const m of manual.models) {
    rows.push({
      source: 'manual',
      rawId: m.id,
      name: m.name,
      lab: m.lab,
      releaseDate: m.releaseDate,
      openWeights: m.openWeights,
      values: m.values,
    })
  }
  sources.push({
    id: 'manual',
    name: 'manual',
    url: 'data/manual.json',
    license: '-',
    credit: 'datos propios',
    fetchedAt: new Date().toISOString(),
    ok: true,
  })

  // a score keeps the best run; a paired cost always comes from that same run
  const apply = (m: Model, values: Record<string, number>, override: boolean) => {
    const improved = new Set<string>()
    for (const [k, v] of Object.entries(values)) {
      const def = metrics.get(k)
      if (def?.pairedWith) continue
      const cur = m.values[k]
      const better = def?.higherIsBetter === false ? v < cur : v > cur
      if (override || cur === undefined || better) {
        m.values[k] = v
        improved.add(k)
      }
    }
    for (const [k, v] of Object.entries(values)) {
      const pair = metrics.get(k)?.pairedWith
      if (pair && (override || improved.has(pair))) m.values[k] = v
    }
  }

  // ---- matching ----------------------------------------------------------
  const models = new Map<string, Model>()
  const variants = new Map<string, Model>()
  const byKey = new Map<string, string>()
  const labRaw = new Map<string, string>()
  const unmatched: Partial<Record<SourceId, string[]>> = {}
  const ignore = new Set(manual.ignore)

  const register = (id: string, ...names: Array<string | undefined>) => {
    for (const n of names) {
      if (!n) continue
      const k = matchKey(n)
      if (k && !byKey.has(k)) byKey.set(k, id)
    }
  }

  const resolve = (r: SourceRow): string | null => {
    const alias = manual.aliases[`${r.source}:${r.rawId}`]
    if (alias) return alias
    for (const n of [r.group, r.name, r.rawId]) {
      if (!n) continue
      const hit = byKey.get(matchKey(n))
      if (hit) return hit
    }
    for (const n of [r.name, r.rawId]) {
      for (const k of looseKeys(n)) {
        const hit = byKey.get(k)
        if (hit) return hit
      }
    }
    return null
  }

  rows.sort(
    (a, b) =>
      ORDER.indexOf(a.source) - ORDER.indexOf(b.source) || (a.group ? -1 : 0) - (b.group ? -1 : 0),
  )

  for (const r of rows) {
    if (ignore.has(`${r.source}:${r.rawId}`)) continue
    let id = resolve(r)
    if (!id) {
      if (!CREATES.includes(r.source) && !openrouterMayCreate(r)) {
        ;(unmatched[r.source] ??= []).push(r.rawId)
        continue
      }
      id = slugify(stripVariant(r.group ?? r.name)) || slugify(r.rawId)
      // two different names can slugify to the same id, keep both
      while (models.has(id) && byKey.get(matchKey(r.group ?? r.name)) !== id) id = `${id}-2`
    }
    let m = models.get(id)
    if (!m) {
      const name = (r.group ?? r.name).replace(/\s*\([^)]*\)\s*$/, '')
      m = { id, name, lab: 'other', releaseDate: null, openWeights: null, values: {}, refs: {} }
      models.set(id, m)
    }
    register(id, r.group, r.name, r.rawId, m.name)

    const lab = labId(r.lab)
    if (m.lab === 'other' && lab !== 'other') {
      m.lab = lab
      if (r.lab && !labRaw.has(lab)) labRaw.set(lab, r.lab)
    }
    if (!m.releaseDate && r.releaseDate && r.source !== 'openrouter') m.releaseDate = r.releaseDate
    if (m.openWeights === null && r.openWeights !== undefined) m.openWeights = r.openWeights ?? null
    // arena names are slugs, a nicer display name from openrouter is welcome
    if (r.source === 'openrouter' && m.name === m.name.toLowerCase() && /[A-Z]/.test(r.name))
      m.name = r.name

    if (r.source === 'openrouter' && !m.releaseDate && !m.refs.epoch && !m.refs.aa)
      m.releaseDate = r.releaseDate ?? null
    apply(m, r.values, r.source === 'manual')
    const refs = (m.refs[r.source] ??= [])
    if (!refs.includes(r.rawId)) refs.push(r.rawId)

    // the same model at one reasoning effort, as its own variant
    const effort = r.source === 'openrouter' ? null : (effortOf(r.rawId) ?? effortOf(r.name))
    if (effort) {
      const vid = `${id}--${slugify(effort)}`
      let v = variants.get(vid)
      if (!v) {
        v = {
          id: vid,
          name: '',
          lab: 'other',
          releaseDate: null,
          openWeights: null,
          values: {},
          refs: {},
          family: id,
          effort,
        }
        variants.set(vid, v)
      }
      apply(v, r.values, r.source === 'manual')
      const vrefs = (v.refs[r.source] ??= [])
      if (!vrefs.includes(r.rawId)) vrefs.push(r.rawId)
    }
  }

  // variants inherit everything but their numbers from the base model
  for (const v of variants.values()) {
    const base = models.get(v.family!)!
    Object.assign(v, {
      name: `${base.name} (${v.effort})`,
      lab: base.lab,
      releaseDate: base.releaseDate,
      openWeights: base.openWeights,
    })
  }

  // openrouter's listing date is a fallback for models nobody else dated
  for (const r of rows) {
    if (r.source !== 'openrouter' || !r.releaseDate) continue
    const id = resolve(r)
    const m = id ? models.get(id) : undefined
    if (m && !m.releaseDate) m.releaseDate = r.releaseDate
  }

  // ---- output ------------------------------------------------------------
  const bases = [...models.values()].filter((m) => Object.keys(m.values).length > 0)
  const keep = new Set(bases.map((m) => m.id))
  // a single variant adds nothing over its base model
  const perFamily = new Map<string, number>()
  for (const v of variants.values()) perFamily.set(v.family!, (perFamily.get(v.family!) ?? 0) + 1)
  const list = [
    ...bases,
    ...[...variants.values()].filter((v) => keep.has(v.family!) && perFamily.get(v.family!)! > 1),
  ]
  const counts = new Map<string, number>()
  for (const m of bases)
    for (const k of Object.keys(m.values)) counts.set(k, (counts.get(k) ?? 0) + 1)
  const metricList = [...metrics.values()]
    .map((d) => ({ ...d, count: counts.get(d.id) ?? 0 }))
    .filter((d) => d.count >= 3)

  const labIds = new Set(list.map((m) => m.lab))
  const dataset: Dataset = {
    generatedAt: new Date().toISOString(),
    sources,
    metrics: metricList,
    labs: [...labIds].sort().map((id) => ({ id, name: labName(id, labRaw.get(id)) })),
    models: list.sort(
      (a, b) =>
        Number(!!a.family) - Number(!!b.family) ||
        (b.values.eci ?? 0) - (a.values.eci ?? 0) ||
        a.name.localeCompare(b.name),
    ),
  }

  await mkdir(join(ROOT, 'public', 'data'), { recursive: true })
  await writeFile(join(ROOT, 'public', 'data', 'dataset.json'), JSON.stringify(dataset))
  await mkdir(RAW_DIR, { recursive: true })
  await writeFile(join(RAW_DIR, 'match-report.json'), JSON.stringify({ unmatched }, null, 2))

  console.log('\ndataset')
  log(
    `${dataset.models.length} models, ${dataset.metrics.length} metrics, ${dataset.labs.length} labs`,
  )
  for (const s of sources) log(`${s.ok ? 'ok ' : '-- '} ${s.name}${s.note ? ` (${s.note})` : ''}`)
  for (const [s, ids] of Object.entries(unmatched))
    log(`${ids.length} ${s} entries unmatched (see data/raw/match-report.json)`)
  const top = dataset.models.filter((m) => m.values.eci).slice(0, 8)
  log(
    'top eci:',
    top
      .map(
        (m) =>
          `${m.name} ${m.values.eci}${m.values['price-blended'] ? ` $${m.values['price-blended'].toFixed(2)}` : ''}`,
      )
      .join(', '),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

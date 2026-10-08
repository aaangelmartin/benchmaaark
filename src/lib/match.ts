// model-name matching across sources.
//
// every source names the same model differently:
//   epoch       "claude-opus-5-5_max", "Claude Opus 5.5"
//   openrouter  "anthropic/claude-opus-5.5", "Anthropic: Claude Opus 5.5"
//   lmarena     "claude-opus-5.5-high"
//   aa          "claude-opus-5-5"
// matchKey() reduces all of them to the same key ("claudeopus55"). anything it
// gets wrong is fixed by hand with aliases in data/manual.json.

// suffixes that describe a run configuration, not a different model.
// "max" only counts after an underscore (epoch's "model_max"), because
// "qwen3-max" or "codex-max" are real model names.
const EFFORT =
  /(?:[-_ ]+(?:x?high|medium|low|minimal|none|thinking|no-thinking|non-thinking|reasoning|non-reasoning|nothink|adaptive|default|latest|preview|exp|experimental)|_(?:max|unknown|auto))$/

// dates glued to version names: 20250514, 2025-05-14, 0514, 2507
const DATE = /[-_ ](?:20\d{2}-?\d{2}-?\d{2}|\d{4})(?=$|[-_ ])/g

export function stripVariant(raw: string): string {
  let s = raw.toLowerCase().trim()
  s = s.replace(/^[a-z0-9.-]+\//, '') // vendor/model
  s = s.replace(/^[^:]{1,40}:\s+/, '') // "Vendor: Model"
  s = s.replace(/:(free|beta|extended|thinking|online)$/, '')
  s = s.replace(/\s*\([^)]*\)\s*/g, ' ').trim() // "(high)", "(max)"
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(EFFORT, '').replace(DATE, '').trim()
  }
  return s
}

export function matchKey(raw: string): string {
  return stripVariant(raw).replace(/[^a-z0-9]/g, '')
}

// second pass for names that did not match as they are: arena lists
// "claude-opus-5-5-max", "gpt-5-search" or "claude-sonnet-4-thinking-32k" for
// what is the same model run differently. only used when the exact key misses,
// so a real "qwen3-max" still matches itself first.
const LOOSE = /[-_ ](?:max|search|grounding|thinking|high|\d+k)$/

export function looseKeys(raw: string): string[] {
  const out: string[] = []
  let s = stripVariant(raw)
  while (LOOSE.test(s)) {
    s = stripVariant(s.replace(LOOSE, ''))
    out.push(s.replace(/[^a-z0-9]/g, ''))
  }
  return out
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

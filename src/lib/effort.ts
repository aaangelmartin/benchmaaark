// reasoning effort, the setting a model ran with: "gpt-6-astra_max",
// "claude-opus-5.5-high", "claude-sonnet-4-thinking-32k". each effort becomes
// its own variant so charts can show and join them.

const LEVELS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export function effortOf(raw: string): string | null {
  const s = raw.toLowerCase().trim()
  // epoch: model_effort
  const epoch = s.match(/_([a-z0-9]+)$/)?.[1]
  if (epoch) {
    if ((LEVELS as readonly string[]).includes(epoch)) return epoch
    if (/^\d+k$/.test(epoch)) return epoch
    if (epoch === 'thinking') return 'thinking'
    return null
  }
  // "(high)", "(reasoning)", "(32k thinking)"
  const paren = s.match(/\(([^)]+)\)\s*$/)?.[1]
  if (paren) return normalise(paren)
  // arena and aa slugs: -high, -thinking-32k, -32k
  const tail = s.match(
    /-(x?high|medium|low|minimal|max|thinking(?:-\d+k)?|\d+k|reasoning|non-reasoning|no-thinking)$/,
  )?.[1]
  return tail ? normalise(tail) : null
}

function normalise(e: string): string | null {
  const s = e.replace(/[^a-z0-9]+/g, ' ').trim()
  const budget = s.match(/(\d+)\s*k/)?.[1]
  if (budget) return `${budget}k`
  for (const l of [...LEVELS].reverse()) if (s.split(' ').includes(l)) return l
  if (/non reasoning|no thinking/.test(s)) return 'none'
  if (/thinking|reasoning/.test(s)) return 'thinking'
  return null
}

// order used to join variants of one model: none < ... < max
export function effortRank(e: string | null | undefined): number {
  if (!e) return 99
  const i = (LEVELS as readonly string[]).indexOf(e)
  if (i >= 0) return i
  if (e === 'thinking') return 4.5
  const k = Number(e.match(/^(\d+)k$/)?.[1])
  return k ? 2 + Math.log2(k) / 3 : 50
}

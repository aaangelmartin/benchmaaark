// canonical labs. every source spells organisations differently, so all of them
// go through labId() before they reach the dataset.

const LABS: Array<[id: string, name: string, patterns: RegExp]> = [
  ['openai', 'OpenAI', /openai/],
  ['anthropic', 'Anthropic', /anthropic|claude/],
  ['google', 'Google', /google|deepmind|gemini|gemma/],
  ['meta', 'Meta', /meta|llama|muse spark/],
  ['xai', 'xAI', /\bxai\b|x-ai|grok/],
  ['deepseek', 'DeepSeek', /deepseek/],
  ['alibaba', 'Alibaba', /alibaba|qwen/],
  ['mistral', 'Mistral', /mistral/],
  ['moonshot', 'Moonshot', /moonshot|kimi/],
  ['zai', 'Z.ai', /z\.ai|zhipu|z-ai|glm/],
  ['minimax', 'MiniMax', /minimax/],
  ['amazon', 'Amazon', /amazon|nova/],
  ['microsoft', 'Microsoft', /microsoft|phi-/],
  ['nvidia', 'NVIDIA', /nvidia/],
  ['cohere', 'Cohere', /cohere/],
  ['xiaomi', 'Xiaomi', /xiaomi|mimo/],
  ['bytedance', 'ByteDance', /bytedance|seed/],
  ['tencent', 'Tencent', /tencent|hunyuan/],
  ['baidu', 'Baidu', /baidu|ernie/],
  ['thinkingmachines', 'Thinking Machines', /thinking machines/],
  ['ai21', 'AI21', /ai21|jamba/],
  ['01ai', '01.AI', /01\.ai|01-ai/],
  ['stepfun', 'StepFun', /stepfun/],
  ['meituan', 'Meituan', /meituan|longcat/],
  ['perplexity', 'Perplexity', /perplexity/],
  ['ibm', 'IBM', /\bibm\b|granite/],
  ['cursor', 'Cursor', /^cursor|composer/],
  ['allenai', 'Ai2', /allen|allenai|\bai2\b|olmo/],
  ['inception', 'Inception', /inception/],
  ['salesforce', 'Salesforce', /salesforce/],
  ['nous', 'Nous Research', /nous/],
  ['lmsys', 'LMSYS', /lmsys|large model systems/],
]

export function labId(raw: string | null | undefined): string {
  const s = (raw ?? '').toLowerCase().trim()
  if (!s) return 'other'
  for (const [id, , re] of LABS) if (re.test(s)) return id
  return (
    s
      .split(',')[0]
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'other'
  )
}

export function labName(id: string, fallback?: string): string {
  return LABS.find(([l]) => l === id)?.[1] ?? fallback?.split(',')[0].trim() ?? id
}

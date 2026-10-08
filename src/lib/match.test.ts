import { describe, expect, it } from 'vitest'
import { labId } from './labs.ts'
import { looseKeys, matchKey } from './match.ts'

describe('matchKey', () => {
  it('reduces every source spelling of a model to one key', () => {
    const key = matchKey('Claude Opus 5.5')
    for (const raw of [
      'claude-opus-5-5_max',
      'anthropic/claude-opus-5.5',
      'Anthropic: Claude Opus 5.5',
      'claude-opus-5.5-high',
      'Claude Opus 5.5 (xhigh)',
    ])
      expect(matchKey(raw)).toBe(key)
  })

  it('drops dates and preview tags', () => {
    expect(matchKey('gpt-5.2-2025-12-11_medium')).toBe(matchKey('GPT-5.2'))
    expect(matchKey('google/gemini-3-pro-preview')).toBe(matchKey('Gemini 3 Pro'))
  })

  it('keeps model names that end in a size or tier', () => {
    expect(matchKey('qwen/qwen3-max')).not.toBe(matchKey('Qwen3'))
    expect(matchKey('gpt-5-mini')).not.toBe(matchKey('GPT-5'))
    expect(matchKey('gpt-5.1-codex-max')).not.toBe(matchKey('gpt-5.1-codex'))
  })

  it('only strips arena run variants in the loose pass', () => {
    expect(looseKeys('claude-opus-5-5-max')).toContain(matchKey('Claude Opus 5.5'))
    expect(looseKeys('claude-sonnet-4-thinking-32k')).toContain(matchKey('Claude Sonnet 4'))
    expect(looseKeys('gpt-5-search')).toContain(matchKey('GPT-5'))
  })
})

describe('labId', () => {
  it('normalises organisation spellings', () => {
    expect(labId('Google DeepMind')).toBe('google')
    expect(labId('x-ai')).toBe('xai')
    expect(labId('Z.ai (Zhipu AI)')).toBe('zai')
    expect(labId('moonshotai')).toBe('moonshot')
    expect(labId('')).toBe('other')
  })
})

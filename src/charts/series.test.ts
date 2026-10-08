import { describe, expect, it } from 'vitest'
import { seriesKey } from './spec.ts'

describe('seriesKey', () => {
  it('puts every version of a line together', () => {
    expect(seriesKey('Claude Opus 5.5')).toBe(seriesKey('Claude Opus 5'))
    expect(seriesKey('GPT-5.6 Sol')).toBe(seriesKey('GPT-6.1 Sol'))
    expect(seriesKey('Gemini 3.8 Flash')).toBe(seriesKey('Gemini 3 Flash'))
  })

  it('keeps different lines of a lab apart', () => {
    expect(seriesKey('Claude Opus 5.5')).not.toBe(seriesKey('Claude Haiku 5.5'))
    expect(seriesKey('GPT-5.6 Sol')).not.toBe(seriesKey('GPT-5.6 Luna'))
    expect(seriesKey('GPT-5.5')).not.toBe(seriesKey('GPT-5.5 Pro'))
  })
})

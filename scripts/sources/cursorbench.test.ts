import { describe, expect, it } from 'vitest'
import { parseCursorBench } from './cursorbench.ts'

describe('parseCursorBench', () => {
  const td = (v: string) => `<td class="x">${v}</td>`
  const row = (
    n: number,
    name: string,
    score: string,
    cost: string,
    tokens: string,
    steps: string,
  ) =>
    `<tr class="r">${td(String(n))}<td><span class="flex"><span class="truncate">${name}</span></span></td>${td(`${score}<!-- -->%`)}${td(`$<!-- -->${cost}`)}${td(tokens)}${td(steps)}</tr>`

  it('reads score, cost, tokens and steps per effort', () => {
    const html = `<table>${row(1, 'Opus 5.5 Max', '57.8', '13.43', '218,363', '185')}${row(2, 'Haiku 5.5 Extra High', '44.3', '0.56', '143,813', '93')}${row(3, 'Composer 2.5', '27.7', '0.68', '17,347', '41')}</table>`
    expect(parseCursorBench(html)).toEqual([
      { name: 'Opus 5.5', effort: 'max', score: 0.578, cost: 13.43, tokens: 218363, steps: 185 },
      {
        name: 'Haiku 5.5',
        effort: 'xhigh',
        score: 0.44299999999999995,
        cost: 0.56,
        tokens: 143813,
        steps: 93,
      },
      {
        name: 'Composer 2.5',
        effort: null,
        score: 0.27699999999999997,
        cost: 0.68,
        tokens: 17347,
        steps: 41,
      },
    ])
  })
})

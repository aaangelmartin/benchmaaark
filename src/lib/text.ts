// svg has no text layout, so titles and labels are measured with a canvas
// using the same font the poster renders with.

let ctx: CanvasRenderingContext2D | null = null

export function measure(text: string, size: number, weight = 500, tracking = 0): number {
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return text.length * size * 0.55
  ctx.font = `${weight} ${size}px Outfit`
  return ctx.measureText(text).width + tracking * size * text.length
}

export function wrap(
  text: string,
  maxWidth: number,
  size: number,
  weight = 500,
  tracking = 0,
): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word
      if (line && measure(next, size, weight, tracking) > maxWidth) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

export function ellipsize(text: string, maxWidth: number, size: number, weight = 500): string {
  if (measure(text, size, weight) <= maxWidth) return text
  let t = text
  while (t.length > 1 && measure(`${t}...`, size, weight) > maxWidth) t = t.slice(0, -1)
  return `${t.trimEnd()}...`
}

// ink bounds of a glyph run, for aligning text against vector artwork
export function glyphBox(text: string, size: number, weight = 500) {
  ctx ??= document.createElement('canvas').getContext('2d')
  if (!ctx) return { ascent: size * 0.7, descent: size * 0.2, left: 0, right: size * 0.9 }
  ctx.font = `${weight} ${size}px Outfit`
  const m = ctx.measureText(text)
  return {
    ascent: m.actualBoundingBoxAscent,
    descent: m.actualBoundingBoxDescent,
    left: m.actualBoundingBoxLeft,
    right: m.actualBoundingBoxRight,
  }
}

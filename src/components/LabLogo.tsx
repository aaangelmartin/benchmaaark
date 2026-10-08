import { labLogo } from '../lib/logos.ts'

// lab logo, or the lab's initial in a ring when there is no logo for it
export function LabLogo({
  lab,
  name,
  className = 'h-5 w-5',
}: {
  lab: string
  name: string
  className?: string
}) {
  const inner = labLogo(lab)
  if (inner)
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`shrink-0 ${className}`}
        aria-hidden
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    )
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border border-current text-[0.6rem] font-bold lowercase ${className}`}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  )
}

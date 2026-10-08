// interface primitives following aaangelmartin.com/brand: lowercase, white on
// cyan, rounded-full pills, 1px white/20 dividers.
import type { ReactNode } from 'react'

export function Section({
  title,
  children,
  aside,
}: {
  title: string
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="border-b border-white-20 py-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-widest text-white-50 lowercase">{title}</h3>
        {aside}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function Pills<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string; hint?: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1 text-xs font-semibold lowercase transition-opacity duration-300 active:scale-[0.97] ${
            o.value === value
              ? 'bg-white text-bg'
              : 'border border-white-30 text-white-80 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-white-80 lowercase">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-300 ${checked ? 'border-white bg-white' : 'border-white-50'}`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-300 ${checked ? 'left-[18px] bg-bg' : 'left-0.5 bg-white-50'}`}
        />
      </button>
    </label>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-white-50 lowercase">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-xl border border-white-30 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white-50 focus:border-white focus:outline-none'

export function Select({
  value,
  onChange,
  groups,
}: {
  value: string
  onChange: (v: string) => void
  groups: Array<{ label: string; options: Array<{ value: string; label: string }> }>
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} appearance-none lowercase`}
    >
      {groups.map((g) =>
        g.options.length ? (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ) : null,
      )}
    </select>
  )
}

export function Button({
  children,
  onClick,
  solid,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  solid?: boolean
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold tracking-wide lowercase transition-opacity duration-300 active:scale-[0.97] disabled:opacity-40 ${
        solid
          ? 'bg-white text-bg hover:opacity-90'
          : 'border-2 border-white-50 text-white hover:border-white'
      }`}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  onRemove,
  active,
  onClick,
}: {
  children: ReactNode
  onRemove?: () => void
  active?: boolean
  onClick?: () => void
}) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium lowercase ${
        active ? 'border-white bg-white text-bg' : 'border-white-30 text-white-80'
      } ${onClick ? 'cursor-pointer hover:border-white' : ''}`}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="opacity-60 hover:opacity-100"
          aria-label="remove"
        >
          ×
        </button>
      )}
    </span>
  )
}

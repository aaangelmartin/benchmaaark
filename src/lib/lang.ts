// one language for the whole site. aaa. offers spanish and english and
// remembers the choice; laaabs. is english only.
import { useSyncExternalStore } from 'react'
import { BRAND } from './brand.ts'
import type { Locale } from './types.ts'

const KEY = 'benchmaaark:lang'
export const CAN_SWITCH_LANG = BRAND.id !== 'laaabs'

function initial(): Locale {
  if (!CAN_SWITCH_LANG) return 'en'
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // no storage, fall through to the browser language
  }
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es')
    ? 'es'
    : 'en'
}

let lang: Locale = initial()
if (typeof document !== 'undefined') document.documentElement.lang = lang
const listeners = new Set<() => void>()

export const getLang = () => lang

export function setLang(next: Locale) {
  if (!CAN_SWITCH_LANG || next === lang) return
  lang = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // not remembered, still applied
  }
  document.documentElement.lang = next
  for (const l of listeners) l()
}

// re-renders the caller when the language changes
export function useLang(): Locale {
  return useSyncExternalStore((cb) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }, getLang)
}

// picks the text for the current language: L('guardar', 'save')
export const L = (es: string, en: string) => (lang === 'en' ? en : es)

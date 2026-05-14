import { createContext, useContext, useMemo, useState, createElement } from 'react'
import eng from '../strings/locales/eng.json'
import heb from '../strings/locales/heb.json'

const LANGUAGES = { eng, heb }
const DEFAULT_LANGUAGE = 'heb'

// Dot-path lookup with optional placeholder interpolation.
//   t('shared.email')                              -> "דוא\"ל"
//   t('shared.days.1')                             -> "שני"
//   t('editHistoryScreen.addedInfo', { EDITOR_USER: 'asaf' })
//     -> "הוסף ע\"י asaf ב-"
//
// Placeholders match <NAME> in the source string. Missing keys return the key
// itself so the gap is visible during development instead of rendering
// "undefined".
function lookup(dict, key) {
  return key.split('.').reduce(
    (acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined),
    dict
  )
}

function interpolate(template, vars) {
  if (!vars || typeof template !== 'string') return template
  return template.replace(/<([A-Z0-9_]+)>/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `<${name}>`
  )
}

// Module-level state for non-React callers (e.g. utils that don't have hook
// access). The React hook keeps this in sync so both worlds agree.
let currentLanguage = DEFAULT_LANGUAGE

export const getLanguage = () => currentLanguage
export const setLanguage = (lang) => {
  if (LANGUAGES[lang]) currentLanguage = lang
}

export const getT = (key, vars) => {
  const dict = LANGUAGES[currentLanguage] || LANGUAGES[DEFAULT_LANGUAGE]
  const value = lookup(dict, key)
  if (value === undefined || value === null) return key
  return interpolate(value, vars)
}

// React context + hook. Wrap the app in <I18nProvider> to enable runtime
// language switching; components use useT() and re-render when the language
// changes via setLang().
const I18nContext = createContext({
  lang: DEFAULT_LANGUAGE,
  setLang: () => {},
  t: getT,
})

export function I18nProvider({ children, initialLanguage }) {
  const [lang, setLangState] = useState(
    LANGUAGES[initialLanguage] ? initialLanguage : DEFAULT_LANGUAGE
  )
  const value = useMemo(() => {
    const dict = LANGUAGES[lang] || LANGUAGES[DEFAULT_LANGUAGE]
    const t = (key, vars) => {
      const v = lookup(dict, key)
      if (v === undefined || v === null) return key
      return interpolate(v, vars)
    }
    const setLang = (next) => {
      if (LANGUAGES[next]) {
        setLangState(next)
        setLanguage(next) // keep module-level in sync for non-React callers
      }
    }
    return { lang, setLang, t }
  }, [lang])
  return createElement(I18nContext.Provider, { value }, children)
}

export const useI18n = () => useContext(I18nContext)
export const useT = () => useContext(I18nContext).t

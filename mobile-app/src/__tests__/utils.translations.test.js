/**
 * Pure-logic tests for the i18n layer. The React-bound parts (I18nProvider
 * + useT) are exercised indirectly when components render in their own
 * test files; here we cover the module-level getT/setLanguage path and
 * the parity guarantee between heb.json and eng.json (which the audit
 * explicitly relies on — a missing key in one locale must surface).
 */

import { getT, setLanguage, getLanguage } from '../utils/translations'
import heb from '../strings/locales/heb.json'
import eng from '../strings/locales/eng.json'

afterEach(() => setLanguage('heb'))

describe('getT — dot-path lookup', () => {
  test('returns the Hebrew string for a known top-level key', () => {
    expect(getT('shared.email')).toBe('דוא"ל')
  })

  test('returns a nested key (shared.days.1 → "שני")', () => {
    expect(getT('shared.days.1')).toBe('שני')
  })

  test('returns the key itself for a missing key (no "undefined" in UI)', () => {
    expect(getT('does.not.exist')).toBe('does.not.exist')
  })
})

describe('getT — placeholder interpolation', () => {
  test('replaces <NAME> with the supplied var', () => {
    setLanguage('eng')
    expect(getT('homeScreen.welcome', { NAME: 'Asaf' })).toBe('Welcome, Asaf')
  })

  test('leaves unreplaced placeholders as <NAME> when var is missing', () => {
    setLanguage('eng')
    expect(getT('homeScreen.welcome')).toBe('Welcome, <NAME>')
  })

  test('supports multiple placeholders in one string', () => {
    // editHistoryScreen.addedInfo: "Added by <EDITOR_USER> on "
    setLanguage('eng')
    expect(getT('editHistoryScreen.addedInfo', { EDITOR_USER: 'asaf' })).toBe('Added by asaf on ')
  })
})

describe('language switching', () => {
  test('defaults to heb', () => {
    expect(getLanguage()).toBe('heb')
  })

  test('setLanguage("eng") flips subsequent getT calls', () => {
    expect(getT('shared.email')).toBe('דוא"ל')
    setLanguage('eng')
    expect(getT('shared.email')).toBe('Email')
  })

  test('setLanguage ignores unknown languages', () => {
    setLanguage('martian')
    expect(getLanguage()).toBe('heb') // still the default
  })
})

describe('locale parity (heb vs eng)', () => {
  // Recursively flatten an object into dot-path keys.
  const flatten = (obj, prefix = '') => {
    const out = {}
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      const path = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, path))
      else out[path] = v
    }
    return out
  }

  test('heb and eng have exactly the same set of leaf keys', () => {
    const hKeys = Object.keys(flatten(heb)).sort()
    const eKeys = Object.keys(flatten(eng)).sort()
    expect(eKeys).toEqual(hKeys)
  })
})

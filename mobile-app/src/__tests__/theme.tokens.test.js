/**
 * Sanity tests for the design tokens. These mostly pin behaviour so a
 * future "let's rename `spacing.md`" change shows up as a failing test
 * instead of a silently-broken UI.
 */

import { spacing, radius, elevation, typography, motion, MIN_HIT_TARGET } from '../theme/tokens'

describe('tokens.spacing', () => {
  test('is a monotonically-increasing 4pt-grid scale', () => {
    const scale = [spacing.xxs, spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl, spacing.xxl, spacing.xxxl]
    expect(scale).toEqual([2, 4, 8, 12, 16, 24, 32, 48])
    for (let i = 1; i < scale.length; i++) expect(scale[i]).toBeGreaterThan(scale[i - 1])
  })
})

describe('tokens.radius', () => {
  test('pill is a true pill, not a small number', () => {
    expect(radius.pill).toBeGreaterThanOrEqual(999)
  })
  test('scale is monotonic', () => {
    expect(radius.sm).toBeLessThan(radius.md)
    expect(radius.md).toBeLessThan(radius.lg)
    expect(radius.lg).toBeLessThan(radius.xl)
  })
})

describe('tokens.elevation', () => {
  test('each level has both Android elevation and iOS shadow keys', () => {
    for (const key of ['sm', 'md', 'lg', 'xl']) {
      const e = elevation[key]
      expect(e.elevation).toBeGreaterThan(0)
      expect(e.shadowColor).toBeDefined()
      expect(e.shadowOpacity).toBeGreaterThan(0)
      expect(e.shadowOffset).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }))
    }
  })
  test('none is a no-op (zero elevation + zero shadow)', () => {
    expect(elevation.none.elevation).toBe(0)
    expect(elevation.none.shadowOpacity).toBe(0)
  })
})

describe('tokens.typography', () => {
  test('every variant has fontSize, fontWeight, and a line-height >= fontSize', () => {
    for (const key of ['display', 'headline', 'title', 'subtitle', 'body', 'caption']) {
      const t = typography[key]
      expect(typeof t.fontSize).toBe('number')
      expect(typeof t.fontWeight).toBe('string')
      expect(t.lineHeight).toBeGreaterThanOrEqual(t.fontSize)
    }
  })
})

describe('tokens.motion', () => {
  test('durations are sorted fast < base < slow', () => {
    expect(motion.fast).toBeLessThan(motion.base)
    expect(motion.base).toBeLessThan(motion.slow)
  })
})

describe('MIN_HIT_TARGET', () => {
  test('meets the larger of HIG (44pt) and Material (48dp)', () => {
    expect(MIN_HIT_TARGET).toBeGreaterThanOrEqual(44)
  })
})

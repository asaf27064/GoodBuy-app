// Design tokens — single source of truth for spacing/radius/typography/etc.
// Migrate screens from magic numbers (padding: 16, borderRadius: 12, ...)
// to these scales so the app looks coherent across every screen.

// 4pt grid. Use spacing.md / spacing.lg etc. throughout the app.
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
}

// Corner-radius scale. `pill` is for capsule-shaped chips/buttons.
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
}

// Material Design elevation levels — keep elevation + shadow in sync so
// Android and iOS render the same visual depth.
export const elevation = {
  none: { elevation: 0, shadowOpacity: 0 },
  sm: {
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  md: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  lg: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  xl: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
}

// Typography scale. Numbers picked to match Material 3 type ramp closely.
export const typography = {
  display: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  headline: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  subtitle: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: '500', lineHeight: 14, letterSpacing: 0.5, textTransform: 'uppercase' },
}

// Animation durations — keep consistent across screens. 200ms is the sweet
// spot for "responsive but not snappy"; 400ms for skeleton shimmer cycles.
export const motion = {
  fast: 150,
  base: 200,
  slow: 400,
  shimmer: 1200,
}

// Hit-target minimum (Apple HIG: 44pt, Material: 48dp). Use the larger
// to be safe — accessibility audits will flag anything smaller.
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 }
export const MIN_HIT_TARGET = 44

export default { spacing, radius, elevation, typography, motion, hitSlop, MIN_HIT_TARGET }

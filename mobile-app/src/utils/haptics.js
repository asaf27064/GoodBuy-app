// Thin wrapper around expo-haptics. The reasons for the wrapper:
//   1) Single source of truth for haptic "vocabulary" used across the app
//      (tap / impact / success / warning / error) so screens don't pick
//      mismatched feedback styles.
//   2) Silently no-ops on platforms / devices where haptics aren't
//      available (web, certain Android phones) — every screen can call
//      these without try/catch.

import * as Haptics from 'expo-haptics'

const safe = (fn) => async () => {
  try { await fn() } catch { /* haptics unavailable — no-op */ }
}

// Light "tick" — for taps on regular buttons / FABs / chips.
export const tap = safe(() => Haptics.selectionAsync())

// Stronger impact — long-press anticipation ("you're about to do X").
export const impactMedium = safe(() =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
)

// Notification-style: shorter, snappier than impact, distinct character.
export const success = safe(() =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
)

export const warning = safe(() =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
)

export const error = safe(() =>
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
)

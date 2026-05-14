import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { useTheme } from 'react-native-paper'
import { spacing, radius, elevation, motion } from '../theme/tokens'

// Shimmering placeholder box. Use directly for a single bar, or compose into
// prebuilt patterns (SkeletonCard / SkeletonRow) for whole screens.
export function Skeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }) {
  const theme = useTheme()
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: motion.shimmer / 2, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: motion.shimmer / 2, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surfaceVariant,
          opacity,
        },
        style,
      ]}
    />
  )
}

// Card-shaped skeleton — matches the ShoppingListScreenItem shape so the
// transition from loading → loaded is visually quiet.
export function SkeletonCard({ style }) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface },
        elevation.md,
        style,
      ]}
    >
      <Skeleton width="60%" height={20} />
      <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
      <View style={styles.actionsRow}>
        {[0, 1, 2, 3, 4].map(i => (
          <Skeleton key={i} width={32} height={32} borderRadius={radius.sm} />
        ))}
      </View>
    </View>
  )
}

// Row-shaped skeleton — for History items, recommendation rows, etc.
export function SkeletonRow({ style }) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.colors.surface },
        elevation.sm,
        style,
      ]}
    >
      <Skeleton width={48} height={48} borderRadius={radius.sm} />
      <View style={{ flex: 1, marginHorizontal: spacing.md }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
      </View>
      <Skeleton width={24} height={24} borderRadius={radius.pill} />
    </View>
  )
}

// Convenience: render N skeleton cards / rows.
export function SkeletonList({ count = 4, variant = 'card' }) {
  const Item = variant === 'row' ? SkeletonRow : SkeletonCard
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
  },
})

export default Skeleton

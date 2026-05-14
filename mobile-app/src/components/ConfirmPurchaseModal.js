import React from 'react'
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native'
import { Text, useTheme, Button } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { spacing, radius, elevation, typography, MIN_HIT_TARGET } from '../theme/tokens'

// Pop-up modal asking the user to confirm the "finish-purchase" action.
export default function ConfirmPurchaseModal({ isVisible, onClose, purchasedItems, handlePurchase, allCheckedFlag }) {
  const theme = useTheme()

  return (
    <Modal transparent visible={isVisible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.container,
            { backgroundColor: theme.colors.surface },
            elevation.xl,
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>

          <MaterialCommunityIcons
            name="cart-check"
            size={48}
            color={theme.colors.primary}
            style={{ marginBottom: spacing.sm }}
          />

          {!allCheckedFlag && (
            <View style={[styles.warnRow, { backgroundColor: theme.colors.errorContainer || '#FEE' }]}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={16}
                color={theme.colors.onErrorContainer || theme.colors.error}
                style={{ marginLeft: spacing.xs }}
              />
              <Text style={[typography.caption, { color: theme.colors.onErrorContainer || theme.colors.error, flex: 1 }]}>
                נותרו מוצרים ברשימה שטרם סומנו.
              </Text>
            </View>
          )}

          <Text style={[typography.title, { color: theme.colors.onSurface, textAlign: 'center', marginTop: spacing.sm }]}>
            סיימת עם הקניות?
          </Text>
          <Text style={[typography.caption, { color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg }]}>
            לחיצה על "אישור" תרוקן את רשימת הקניות ותמחק את היסטוריית העריכה של הרשימה.
          </Text>

          <View style={styles.actionsRow}>
            <Button
              mode="outlined"
              onPress={onClose}
              style={[styles.actionBtn, { borderColor: theme.colors.outline }]}
              contentStyle={{ paddingVertical: spacing.xs }}
            >
              ביטול
            </Button>
            <Button
              mode="contained"
              onPress={() => handlePurchase(purchasedItems)}
              style={styles.actionBtn}
              contentStyle={{ paddingVertical: spacing.xs }}
              buttonColor={theme.colors.primary}
            >
              אישור
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: MIN_HIT_TARGET - 12,
    height: MIN_HIT_TARGET - 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.md,
  },
})

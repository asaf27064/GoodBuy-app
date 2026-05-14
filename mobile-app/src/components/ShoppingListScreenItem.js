import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { spacing, radius, elevation, typography, MIN_HIT_TARGET } from '../theme/tokens';

// An item in the shopping list screen.
// Contains the list's name and usernames of the members of the list, as well as
// five buttons leading to key app features: list editor, get recommendations, price comparison,
// check items and view edit history.
export default function ShoppingListScreenItem({ listObj, navigation }) {
  const theme = useTheme();
  const { title, members = [], _id } = listObj;
  const memberLabels = members
    .map(u => (typeof u === 'string' ? '' : (u?.username || u?.email || '')))
    .filter(Boolean)
    .join(', ');

  const goToEditList = () => navigation.navigate('EditItems', { listObj })
  const goToCheckList = () => navigation.navigate('CheckItems', { listObj })
  const goToEditHistory = () => navigation.navigate('EditHistory', { listObj })
  const goToSuggestions = () => navigation.navigate('Recommend', { listObj })
  const goToPriceComparison = () => navigation.navigate('Compare', { listObj })

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }, elevation.md]}>
      <Card.Content>
        <Text
          style={[
            typography.title,
            { color: theme.colors.onSurface, textAlign: 'right' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={[
            typography.caption,
            {
              color: theme.colors.onSurfaceVariant,
              marginTop: spacing.xs,
              textAlign: 'right',
            },
          ]}
          numberOfLines={1}
        >
          חברים ברשימה: {memberLabels || '—'}
        </Text>
      </Card.Content>

      <Card.Actions style={styles.actions}>
        <ActionButton icon="playlist-edit" onPress={goToEditList} accessibilityLabel="Edit list" />
        <ActionButton icon="lightbulb-on-outline" onPress={goToSuggestions} accessibilityLabel="Recommendations" />
        <ActionButton icon="scale-balance" onPress={goToPriceComparison} accessibilityLabel="Compare prices" />
        <ActionButton icon="checkbox-marked-circle-outline" onPress={goToCheckList} accessibilityLabel="Check items" />
        <ActionButton icon="history" onPress={goToEditHistory} accessibilityLabel="Edit history" />
      </Card.Actions>
    </Card>
  );
}

function ActionButton({ icon, onPress, accessibilityLabel }) {
  const theme = useTheme()
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.btn}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <MaterialCommunityIcons name={icon} size={24} color={theme.colors.primary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: radius.md,
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  btn: {
    padding: spacing.sm,
    minWidth: MIN_HIT_TARGET,
    minHeight: MIN_HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

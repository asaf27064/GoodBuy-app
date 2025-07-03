import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Checkbox, Text, useTheme } from 'react-native-paper';

// An item in the checklist, containing a checkbox, the product's name and the number of units to purchase.

export default function CheckListScreenItem({ product, checkStatus, handleCheck }) {
  const theme = useTheme();

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>      
      <Card.Content style={styles.row}>
        <Checkbox.Android
          status={checkStatus ? 'checked' : 'unchecked'}
          onPress={() => handleCheck(product)}
          color={theme.colors.primary}
        />
        <View style={styles.textContainer}>
          <Text
            style={[styles.name, { color: theme.colors.onSurface }, checkStatus && styles.checkedText]}
            numberOfLines={1}
          >
            {product.product.name}
          </Text>
          <Text
            style={[styles.quantity, { color: theme.colors.onSurfaceVariant }, checkStatus && styles.checkedText]}
          >
            x{product.numUnits}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  textContainer: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    flexShrink: 1,
  },
  quantity: {
    fontSize: 14,
    marginLeft: 12,
  },
  checkedText: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
});
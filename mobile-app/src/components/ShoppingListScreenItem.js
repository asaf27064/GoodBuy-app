import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Paragraph, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';


// An item in the shopping list screen.
// Contains the list's name and usernames of the members of the list, as well as
// five buttons leading to key app features: list editor, get recommendations, price comparison,
// check items and view edit history.
export default function ShoppingListScreenItem({ listObj, navigation }) {
  const theme = useTheme();
  const { title, members, _id } = listObj;

  const goToEditList = () =>
    navigation.navigate('EditItems', { listObj })
  const goToCheckList = () =>
    navigation.navigate('CheckItems', { listObj })
  const goToEditHistory = () =>
    navigation.navigate('EditHistory', { listObj })
  const goToSuggestions = () =>
    navigation.navigate('Recommend', { listObj })
  const goToPriceComparison = () =>
    navigation.navigate('Compare', { listObj })

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content>
        <Text style={[theme.text, theme.headlineMedium, { color: theme.colors.onSurface }]}>{title}</Text>
        <Text style={[theme.text, theme.mutedText, {marginVertical: 5}]}>
          חברים ברשימה: {members.map(u => u.username).join(', ')}
        </Text>
      </Card.Content>

      <Card.Actions style={styles.actions}>
        <ActionButton icon="playlist-edit" onPress={goToEditList} />
        <ActionButton icon="lightbulb-on-outline" onPress={goToSuggestions} />
        <ActionButton icon="scale-balance" onPress={goToPriceComparison} />
        <ActionButton icon="checkbox-marked-circle-outline" onPress={goToCheckList} />
        <ActionButton icon="history" onPress={goToEditHistory} />
      </Card.Actions>
    </Card>
  );
}

function ActionButton({ icon, onPress }) {
  const theme = useTheme()
  return (
    <TouchableOpacity onPress={onPress} style={styles.btn}>
      <MaterialCommunityIcons
        name={icon}
        size={24}
        color={theme.colors.primary}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 3
  },
  actions: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  btn: {
    padding: 8
  }
})

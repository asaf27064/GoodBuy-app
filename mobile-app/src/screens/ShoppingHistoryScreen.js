import React, { useEffect, useState, useCallback } from 'react'
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  StyleSheet
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from 'react-native-paper'
import makeGlobalStyles from '../styles/globalStyles'
import ShoppingHistoryScreenItem from '../components/ShoppingHistoryScreenItem';

export default function ShoppingHistoryScreen({route, navigation}) {

    
  const { user } = useAuth()
  const theme = useTheme()
  const styles = makeGlobalStyles(theme)

  const [history, setHistory] = useState([]);

  // Re-fetch every time the History tab gets focus, not only on first mount.
  // Otherwise a fresh purchase made in CheckList won't show until app restart.
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return
      let active = true
      axios
        .get(`/api/Purchases/` + user.id)
        .then(({ data }) => { if (active) setHistory(Array.isArray(data) ? data : []) })
        .catch(err => {
          console.error('Error fetching purchase history:', err)
          if (active) setHistory([])
        })
      return () => { active = false }
    }, [user?.id])
  )

  const renderItem = ({ item }) => {
    // listId may be null if the source list was deleted, or a raw ObjectId
    // if a code path skipped .populate(); fall back to a generic title.
    const title = (item.listId && typeof item.listId === 'object' && item.listId.title)
      ? item.listId.title
      : 'רשימה שנמחקה';
    return (
      <ShoppingHistoryScreenItem title={title} purchasedProds={item.products} timeStamp={item.timeStamp}/>
    );
    /*
    <View style={localStyles.row}>
      <Text style={{ color: theme.colors.onSurface }}>
        {new Date(item.timeStamp).toLocaleString()}
      </Text>
      <Text style={{ color: theme.colors.onSurface }}>
        {item.products?.length ?? 0} items
      </Text>
    </View>*/
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={{marginVertical: 10}}
        data={history}
        keyExtractor={r => r._id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={localStyles.emptyText}>
            היסטוריית הרכישה שלך ריקה.
          </Text>
        }
      />
    </SafeAreaView>
  )
}



const localStyles = StyleSheet.create({
  row: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc'
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20
  }
})

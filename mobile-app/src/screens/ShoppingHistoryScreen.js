import React, { useState, useCallback } from 'react'
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import axios from 'axios'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from 'react-native-paper'
import makeGlobalStyles from '../styles/globalStyles'
import ShoppingHistoryScreenItem from '../components/ShoppingHistoryScreenItem'
import { SkeletonList } from '../components/Skeleton'
import { spacing, typography } from '../theme/tokens'

export default function ShoppingHistoryScreen({ route, navigation }) {
  const { user } = useAuth()
  const theme = useTheme()
  const styles = makeGlobalStyles(theme)

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHistory = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await axios.get(`/api/Purchases/` + user.id)
      setHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching purchase history:', err)
      setHistory([])
    }
  }, [user?.id])

  // Re-fetch every time the History tab gets focus, not only on first mount.
  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        await fetchHistory()
        if (active) setLoading(false)
      })()
      return () => { active = false }
    }, [fetchHistory])
  )

  const onRefresh = async () => {
    setRefreshing(true)
    try { await fetchHistory() }
    finally { setRefreshing(false) }
  }

  const renderItem = ({ item }) => {
    // listId may be null if the source list was deleted, or a raw ObjectId
    // if a code path skipped .populate(); fall back to a generic title.
    const title = (item.listId && typeof item.listId === 'object' && item.listId.title)
      ? item.listId.title
      : 'רשימה שנמחקה'
    return (
      <ShoppingHistoryScreenItem
        title={title}
        purchasedProds={item.products}
        timeStamp={item.timeStamp}
      />
    )
  }

  const EmptyState = () => (
    <View style={localStyles.emptyContainer}>
      <MaterialCommunityIcons
        name="clipboard-text-clock-outline"
        size={64}
        color={theme.colors.onSurfaceDisabled}
      />
      <Text style={[typography.title, { color: theme.colors.onSurface, marginTop: spacing.lg, textAlign: 'center' }]}>
        היסטוריית הרכישה שלך ריקה
      </Text>
      <Text style={[typography.body, { color: theme.colors.onSurfaceVariant, marginTop: spacing.sm, textAlign: 'center' }]}>
        ברגע שתסיים רכישה היא תופיע כאן.
      </Text>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ paddingTop: spacing.md }}>
          <SkeletonList count={5} variant="row" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        style={{ marginVertical: spacing.sm }}
        data={history}
        keyExtractor={r => r._id}
        renderItem={renderItem}
        contentContainerStyle={history.length === 0 ? { flexGrow: 1 } : null}
        ListEmptyComponent={EmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    </SafeAreaView>
  )
}

const localStyles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
})

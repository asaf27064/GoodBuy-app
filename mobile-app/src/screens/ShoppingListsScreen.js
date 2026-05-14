import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { View, FlatList, SafeAreaView, TouchableOpacity, RefreshControl, Alert, Text } from 'react-native'
import { useTheme } from 'react-native-paper'
import { useFocusEffect } from '@react-navigation/native'
import makeGlobalStyles from '../styles/globalStyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import ShoppingListScreenItem from '../components/ShoppingListScreenItem'
import AddListModal from '../components/AddListModal'
import PriceSyncBanner from '../components/PriceSyncBanner'
import { SkeletonList } from '../components/Skeleton'
import { spacing, radius, elevation, typography } from '../theme/tokens'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import CheckListScreen from './CheckListScreen'
import EditListScreen from './EditListScreen'
import EditHistoryScreen from './EditHistoryScreen'
import RecommendationScreen from './RecommendationsScreen'
import PriceComparisonScreen from './PriceComparisonScreen'
import AddItemScreen from './AddItemScreen'
import { useListSocket } from '../contexts/ListSocketContext'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE } from '../config'

// Defined baseURL, all requests URLs will implicitly include it.
axios.defaults.baseURL = API_BASE;
MaterialCommunityIcons.loadFont();

const Stack = createNativeStackNavigator()

// Define stack for the shopping list screens.
// Includes all screens you can navigate to from a "ShoppingListScreenItem", as well as the app menu via a drawer.
export function ShoppingListStack() {
  const theme = useTheme()
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: theme.colors.onPrimary,
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitleAlign: 'center',
        headerRight: () => (
          <MaterialCommunityIcons.Button
            name="menu"
            size={24}
            color={theme.colors.onPrimary}
            backgroundColor={theme.colors.primary}
            onPress={() => navigation.openDrawer()}
            iconStyle={{ marginRight: 0 }}
            style={{ paddingHorizontal: 16 }}
          />
        )
      })}
    >
      <Stack.Screen name="My Shopping Lists"
       component={ShoppingListScreen}
        options={{ 
          title: "רשימות הקנייה שלי",
          headerShown: true,
          headerBackVisible: false }} />

      <Stack.Screen name="CheckItems" component={CheckListScreen} options={({ route }) => ({ title: `${route.params.listObj.title}: סימון מוצרים` })} />
      <Stack.Screen name="EditItems" component={EditListScreen} options={({ route }) => ({ title: `${route.params.listObj.title}: עריכת רשימה` })} />
      <Stack.Screen name="AddItem" component={AddItemScreen} options={{ title: 'הוספת מוצר' }} />
      <Stack.Screen name="EditHistory" component={EditHistoryScreen} options={({ route }) => ({ title: `${route.params.listObj.title}: היסטוריית עריכה` })} />
      <Stack.Screen name="Recommend" component={RecommendationScreen} options={({ route }) => ({ title: `${route.params.listObj.title}: המלצות` })} />
      <Stack.Screen name="Compare" component={PriceComparisonScreen} options={({ route }) => ({ title: `${route.params.listObj.title}: השוואת מחירים` })} />
    </Stack.Navigator>
  )
}

export default function ShoppingListScreen({ navigation, route }) {
  const theme = useTheme();
  const styles = makeGlobalStyles(theme);
  const insets = useSafeAreaInsets();
  const [isModalVisible, setModalVisible] = useState(false);
  const [shoppingLists, setShoppingLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { on, off } = useListSocket();
  const { user } = useAuth();

  const userIdStr = (user?.id || user?._id || '').toString();

  // Given a current list (prev) and a new list (incoming), merge them into a new list.
  const mergeLists = (prev, incoming) => {
    const map = new Map();
    prev.forEach(l => map.set(l._id, l));
    incoming.forEach(l => map.set(l._id, l));
    return Array.from(map.values());
  }

  const isMember = (list) => list?.members?.map(m => (m._id || m).toString()).includes(userIdStr);

  // Get all current current user's lists.
  const fetchShoppingLists = async () => {
    try {
      const { data } = await axios.get('/api/ShoppingLists');
      // Authoritative full-fetch: REPLACE local state, don't merge.
      // Merging here causes deleted lists / lists the user was removed from
      // to stick around in the UI forever.
      setShoppingLists(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false) }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchShoppingLists(); }
    finally { setRefreshing(false); }
  };

  // Leave list
  const leaveList = async (listId) => {
    try {
      await axios.post(`/api/ShoppingLists/${listId}/leave`);
      setShoppingLists(prev => prev.filter(l => l._id !== listId));
    } catch (e) {
      Alert.alert('שגיאה', 'הסרה מהרשימה נכשלה..');
    }
  };

  const confirmLeave = (listObj) => {
    Alert.alert(
      'פרישה מרשימה',
      `לפרוש מהרשימה "${listObj.title}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'פרוש', style: 'destructive', onPress: () => leaveList(listObj._id) }
      ]
    );
  };

  // Fetches user's list when the component initially mounts.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await axios.get('/api/ShoppingLists')
        if (active) setShoppingLists(Array.isArray(data) ? data : [])
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [])

  // When a user creates a list, all members recieve a "listCreated" emission, invoking this function,
  // Which updates each user's shopping lists.
  useEffect(() => {
    const h = l => {
      if (!l?.members) return
      const uid = user?.id || user?._id
      if (!uid) return
      if (l.members.some(m => String(m?._id || m) === String(uid)))
        setShoppingLists(prev => mergeLists(prev, [l]))
    }
    on('listCreated', h)
    return () => off('listCreated', h)
  }, [on, off, user]);

  // Keep lists in sync when server broadcasts updates/deletes/leaves
  useEffect(() => {
    const onUpdated = (l) => {
      if (isMember(l)) {
        setShoppingLists(prev => mergeLists(prev, [l]));
      } else {
        setShoppingLists(prev => prev.filter(x => x._id !== l._id));
      }
    };
    const onDeleted = ({ listId }) => {
      setShoppingLists(prev => prev.filter(x => x._id !== listId));
    };
    const onLeft = ({ listId }) => {
      setShoppingLists(prev => prev.filter(x => x._id !== listId));
    };
    on('listUpdated', onUpdated);
    on('listDeleted', onDeleted);
    on('listLeft', onLeft);
    return () => {
      off('listUpdated', onUpdated);
      off('listDeleted', onDeleted);
      off('listLeft', onLeft);
    };
  }, [on, off, userIdStr]);

  // Fetch user's lists when the user presses the "Shopping Lists" bottom tab.
  // Invoked only if the loading state is false, or when a change occurs on the refreshList/timestamp parameters.
  useFocusEffect(
    React.useCallback(() => {
      if (!loading) fetchShoppingLists();
      const rId = route.params?.refreshList;
      const ts = route.params?.timestamp;
      if (rId || ts) {
        fetchShoppingLists();
        navigation.setParams({ refreshList: undefined, timestamp: undefined });
      }
    }, [route.params?.refreshList, route.params?.timestamp, navigation, loading])
  );

  const addList = () => setModalVisible(true);
  const close = () => setModalVisible(false);

  // Create a new list in the server upon confiming in "addListModal".
  const createNewList = async (title, ids, imp) => {
    try {
      const { data } = await axios.post('/api/ShoppingLists', { title, members: ids});
      setShoppingLists(prev => mergeLists(prev, [data]));
      close();
    } catch {}
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onLongPress={() => confirmLeave(item)}
      delayLongPress={450}
    >
      <ShoppingListScreenItem listObj={item} navigation={navigation} />
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ paddingTop: spacing.sm }}>
          <SkeletonList count={4} variant="card" />
        </View>
      </SafeAreaView>
    )
  }

  const EmptyState = () => (
    <View style={{ alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xxxl }}>
      <MaterialCommunityIcons
        name="cart-outline"
        size={64}
        color={theme.colors.onSurfaceDisabled}
      />
      <Text style={[typography.title, { color: theme.colors.onSurface, marginTop: spacing.lg, textAlign: 'center' }]}>
        אין רשימות עדיין
      </Text>
      <Text style={[typography.body, { color: theme.colors.onSurfaceVariant, marginTop: spacing.sm, textAlign: 'center' }]}>
        לחצו על הכפתור למטה ליצירת הרשימה הראשונה.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AddListModal isVisible={isModalVisible} onClose={close} createList={createNewList} />
      <View style={{ flex: 1 }}>
        {/*<PriceSyncBanner />*/}
        <FlatList
          data={shoppingLists}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingVertical: spacing.sm,
            paddingBottom: insets.bottom + 120,
            flexGrow: 1,
          }}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
        />
      </View>
      <TouchableOpacity
        onPress={addList}
        style={[
          {
            position: 'absolute',
            right: spacing.xl,
            padding: spacing.lg,
            borderWidth: 2,
            borderRadius: radius.xl,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          },
          elevation.xl,
          {
            bottom: insets.bottom + 80,
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          },
        ]}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" color={theme.colors.onPrimary} size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

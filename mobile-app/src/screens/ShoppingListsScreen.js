import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { View, FlatList, SafeAreaView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTheme } from 'react-native-paper'
import { useFocusEffect } from '@react-navigation/native'
import makeGlobalStyles from '../styles/globalStyles'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import ShoppingListScreenItem from '../components/ShoppingListScreenItem'
import AddListModal from '../components/AddListModal'
import PriceSyncBanner from '../components/PriceSyncBanner'
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
  const { on, off } = useListSocket();
  const { user } = useAuth();

  // Given a current list (prev) and a new list (incoming), merge them into a new list.
  const mergeLists = (prev, incoming) => {
    const map = new Map();
    
    // Create key-value pair of (list_id, actual list) for each element in prev.
    prev.forEach(l => map.set(l._id, l));

    // Do the same for incoming, and since it's a map, existing keys will be updated with the new value.
    incoming.forEach(l => map.set(l._id, l));

    return Array.from(map.values());
  }

  // Get all current current user's lists.
  const fetchShoppingLists = async () => {
    try {
      const { data } = await axios.get('/api/ShoppingLists');

      // Update user's lists with updated data from server.
      setShoppingLists(prev => mergeLists(prev, data));
    } catch {}
    finally { setLoading(false) }
  }


  // Fetches user's list when the component initially mounts.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await axios.get('/api/ShoppingLists')
        if (active) setShoppingLists(prev => mergeLists(prev, data))
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [])


  // When a user creates a list, all members recieve a "listCreated" emission, invoking this function,
  // Which updates each user's shopping lists.
  useEffect(() => {
    const h = l => {
      if (l.members.some(m => m._id === user.id || m._id === user._id))
        setShoppingLists(prev => mergeLists(prev, [l]))
    }
    on('listCreated', h)
    return () => off('listCreated', h)
  }, [on, off, user]);


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

  const renderItem = ({ item }) => <ShoppingListScreenItem listObj={item} navigation={navigation} />

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <AddListModal isVisible={isModalVisible} onClose={close} createList={createNewList} />
      <View style={{ flex: 1 }}>
        {/*<PriceSyncBanner />*/}
        <FlatList
          data={shoppingLists}
          keyExtractor={i => i._id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: insets.bottom + 120 }}
          showsVerticalScrollIndicator
          style={{ flex: 1 }}
        />
      </View>
      <TouchableOpacity
        onPress={addList}
        style={[{ position: 'absolute', right: 20, padding: 16, borderWidth: 2, borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 12 }, { bottom: insets.bottom + 80, backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
        underlayColor={theme.colors.surface}
      >
        <MaterialCommunityIcons name="plus" color={theme.colors.onPrimary} size={28} />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

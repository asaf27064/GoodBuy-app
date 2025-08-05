import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import {
  View,
  FlatList,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar
} from 'react-native'
import {
  Searchbar,
  IconButton,
  useTheme,
  ActivityIndicator,
  Chip,
} from 'react-native-paper'
import debounce from 'lodash/debounce'
import axios from 'axios'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAddItem } from '../contexts/AddItemContext'
import { API_BASE } from '../config'

axios.defaults.baseURL = API_BASE

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_MARGIN = 8
const CARD_WIDTH = (SCREEN_WIDTH - CARD_MARGIN * 3) / 2

export default function AddItemScreen({ route, navigation }) {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const { listObj } = route.params
  const { callItemSelect } = useAddItem()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [viewMode, setViewMode] = useState('list')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [recentSearches, setRecentSearches] = useState(['חלב', 'לחם', 'ביצים', 'עוף'])

  const searchBarRef = useRef(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  const existingCodesRef = useRef(
    new Set(
      (listObj?.products || [])
        .map(p => String(p?.product?.itemCode))
        .filter(Boolean)
    )
  )
  const [selectedCodes, setSelectedCodes] = useState(new Set())

  const isPreExisting = (code) => existingCodesRef.current.has(String(code))
  const isSelectedNow = (code) => selectedCodes.has(String(code))
  const isSelected = (code) => isPreExisting(code) || isSelectedNow(code)

  const markSelected = (code) => {
    setSelectedCodes(prev => {
      const next = new Set(prev)
      next.add(String(code))
      return next
    })
  }
  const unmarkSelected = (code) => {
    setSelectedCodes(prev => {
      const next = new Set(prev)
      next.delete(String(code))
      return next
    })
  }

  const removeFromList = async (itemCode) => {
    try {
      await axios.put(`/api/ShoppingLists/${listObj._id}`, {
        changes: [
          { action: 'removed', product: { itemCode: String(itemCode) } }
        ]
      })
    } catch (e) {
      console.error('removeFromList failed:', e?.response?.data || e.message)
    }
  }

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => null })
  }, [navigation])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
    setTimeout(() => searchBarRef.current?.focus(), 600)
  }, [fadeAnim, slideAnim])

  const doSearch = useCallback(
    debounce(async term => {
      if (!term.trim()) {
        setResults([])
        setCategories([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const { data } = await axios.get(`/api/Products/search/${term}`)
        setResults(data.results || [])
        const uniqueCategories = [...new Set((data.results || []).map(i => i.category).filter(Boolean))]
        setCategories(uniqueCategories.slice(0, 6))
      } catch (e) {
        console.error(e)
        setResults([])
        setCategories([])
      } finally {
        setLoading(false)
      }
    }, 400),
    []
  )

  const onChange = text => {
    setQuery(text)
    setSelectedCategory(null)
    doSearch(text)
  }

  const handleRecentSearch = (term) => {
    setQuery(term)
    doSearch(term)
  }

  const handleCategorySelect = (category) => {
    setSelectedCategory(selectedCategory === category ? null : category)
  }


  const handleItemPress = async (item) => {
    const codeStr = String(item.itemCode)

    if (isPreExisting(codeStr)) {
      return
    }

    if (isSelectedNow(codeStr)) {
      await removeFromList(codeStr)
      unmarkSelected(codeStr)
      return
    }

    const selectedItem = {
      itemCode: item.itemCode,
      name: item.itemName,
      image: item.imageUrl,
      category: item.category
    }
    callItemSelect(selectedItem)
    markSelected(codeStr)
  }

  const filteredResults = selectedCategory 
    ? results.filter(item => item.category === selectedCategory)
    : results

  const Thumbnail = ({ uri, style }) => {
    const [error, setError] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)
    if (!uri || error) {
      return (
        <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="image-off-outline" size={viewMode === 'grid' ? 32 : 24} color={theme.colors.onSurfaceDisabled} />
        </View>
      )
    }
    return (
      <View style={style}>
        {imageLoading && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surfaceVariant }]}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        )}
        <Image
          source={{ uri }}
          style={[style, { position: imageLoading ? 'absolute' : 'relative' }]}
          onError={() => setError(true)}
          onLoad={() => setImageLoading(false)}
          resizeMode="cover"
        />
      </View>
    )
  }

  const renderListItem = ({ item }) => {
    const codeStr = String(item.itemCode)
    const pre = isPreExisting(codeStr)
    const sel = isSelected(codeStr)
    const borderOn = sel
    const disabled = pre ? true : false
    return (
      <TouchableOpacity
        style={[
          styles.listRow,
          { 
            backgroundColor: theme.colors.surface,
            borderWidth: borderOn ? 2 : 0,
            borderColor: borderOn ? theme.colors.primary : 'transparent',
            opacity: pre ? 0.85 : 1
          }
        ]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Thumbnail uri={item.imageUrl} style={styles.listThumb} />
        <View style={styles.listText}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{item.itemName}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {item.category ? `${item.category} • ` : ''}מק"ט: {item.itemCode}
          </Text>
        </View>
        <MaterialCommunityIcons 
          name={pre ? 'check-decagram' : (sel ? 'check-circle' : 'plus-circle-outline')}
          size={24}
          color={pre ? theme.colors.primary : theme.colors.primary}
        />
      </TouchableOpacity>
    )
  }

  const renderGridItem = ({ item }) => {
    const codeStr = String(item.itemCode)
    const pre = isPreExisting(codeStr)
    const sel = isSelected(codeStr)
    const disabled = pre ? true : false

    return (
      <TouchableOpacity
        style={[
          styles.cardContainer,
          { 
            backgroundColor: theme.colors.surface,
            borderColor: sel ? theme.colors.primary : theme.colors.outline,
            opacity: pre ? 0.9 : 1
          }
        ]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.8}
        disabled={disabled}
      >
        <Thumbnail uri={item.imageUrl} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]} numberOfLines={2}>
            {item.itemName}
          </Text>
          {item.category && (
            <Text style={[styles.cardCategory, { color: theme.colors.onSurfaceVariant }]}>
              {item.category}
            </Text>
          )}
        </View>
        <View style={[styles.addButton, { backgroundColor: theme.colors.primary, opacity: pre ? 0.7 : 1 }]}>
          <MaterialCommunityIcons
            name={pre ? 'check' : (sel ? 'check' : 'plus')}
            size={16}
            color={theme.colors.onPrimary}
          />
        </View>
      </TouchableOpacity>
    )
  }

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons 
        name={query ? "magnify-close" : "magnify"} 
        size={64} 
        color={theme.colors.onSurfaceDisabled} 
      />
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        {query ? 'לא נמצאו מוצרים מתאימים' : 'חיפוש מוצרים'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
        {query 
          ? `אין לנו "${query}" במאגר. נסו איות שונה.` 
          : 'הקלידו בתיבת החיפוש ובחרו מבין האפשרויות.'
        }
      </Text>
    </View>
  )

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar backgroundColor={theme.colors.surface} barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.searchHeader, 
          { 
            backgroundColor: theme.colors.surface,
            paddingTop: insets.top,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.searchRow}>
          <IconButton
            icon={viewMode === 'list' ? 'view-grid' : 'format-list-bulleted'}
            size={24}
            iconColor={theme.colors.onSurface}
            style={[styles.viewToggle, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={() => setViewMode(prev => (prev === 'list' ? 'grid' : 'list'))}
          />
          <Searchbar
            ref={searchBarRef}
            placeholder="הזן שם מוצר..."
            onChangeText={onChange}
            value={query}
            style={[styles.searchbar, { backgroundColor: theme.colors.surfaceVariant }]}
            inputStyle={{ color: theme.colors.onSurface }}
            iconColor={theme.colors.onSurfaceVariant}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            loading={loading}
            elevation={0}
          />
        </View>

        {!query && (
          <View style={styles.recentsContainer}>
            <Text style={[styles.recentsTitle, theme.text, { color: theme.colors.onSurfaceVariant }]}>
              חיפושים אחרונים
            </Text>
            <View style={styles.chipsRow}>
              {recentSearches.map((term, index) => (
                <Chip
                  key={index}
                  mode="outlined"
                  onPress={() => handleRecentSearch(term)}
                  style={[styles.chip, { borderColor: theme.colors.outline }]}
                  textStyle={{ color: theme.colors.onSurface }}
                >
                  {term}
                </Chip>
              ))}
            </View>
          </View>
        )}

        {categories.length > 0 && (
          <View style={styles.categoriesContainer}>
            <Text style={[styles.categoriesTitle, { color: theme.colors.onSurfaceVariant }]}>
              Filter by category
            </Text>
            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item, index) => index.toString()}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <Chip
                  mode={selectedCategory === item ? 'flat' : 'outlined'}
                  selected={selectedCategory === item}
                  onPress={() => handleCategorySelect(item)}
                  style={[
                    styles.categoryChip,
                    selectedCategory === item && { backgroundColor: theme.colors.primary }
                  ]}
                  textStyle={{ 
                    color: selectedCategory === item ? theme.colors.onPrimary : theme.colors.onSurface 
                  }}
                >
                  {item}
                </Chip>
              )}
            />
          </View>
        )}
      </Animated.View>

      <FlatList
        key={`${viewMode}-${selectedCategory}`}
        data={filteredResults}
        keyExtractor={(item, i) => `${item.itemCode}_${i}`}
        renderItem={viewMode === 'list' ? renderListItem : renderGridItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, filteredResults.length === 0 && styles.emptyList]}
        numColumns={viewMode === 'grid' ? 2 : 1}
        ListEmptyComponent={!loading ? EmptyState : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    paddingBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  searchbar: {
    flex: 1,
    elevation: 0,
    borderRadius: 12,
  },
  viewToggle: {
    borderRadius: 12,
  },
  recentsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  recentsTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chip: { marginRight: 0 },
  categoriesContainer: { paddingTop: 12 },
  categoriesTitle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryChip: { marginLeft: 8, marginRight: 0 },
  list: { paddingBottom: 16, paddingTop: 8 },
  emptyList: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  listThumb: { width: 56, height: 56, borderRadius: 8 },
  listText: { marginLeft: 16, flex: 1 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  cardContainer: {
    width: CARD_WIDTH,
    margin: CARD_MARGIN,
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.7,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  cardContent: { padding: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  cardCategory: { fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  addButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
})

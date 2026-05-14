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
  Surface
} from 'react-native-paper'
import debounce from 'lodash/debounce'
import axios from 'axios'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { MotiView, AnimatePresence } from 'moti'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAddItem } from '../contexts/AddItemContext'
import { spacing, radius, elevation, typography } from '../theme/tokens'
import { API_BASE } from '../config'

axios.defaults.baseURL = API_BASE

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
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
  
  const searchBarRef = useRef(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(50)).current

  // Remove Drawer Button from header (run once per navigation)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => null,
    })
  }, [navigation])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start()

    const focusTimer = setTimeout(() => searchBarRef.current?.focus(), 600)
    return () => clearTimeout(focusTimer)
  }, [])

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
        const { data } = await axios.get(`/api/Products/search/${encodeURIComponent(term)}`)
        setResults(data.results || [])
        
        const uniqueCategories = [...new Set(
          (data.results || [])
            .map(item => item.category)
            .filter(Boolean)
        )]
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


  const handleCategorySelect = (category) => {
    setSelectedCategory(selectedCategory === category ? null : category)
  }

  const handleItemSelect = (item) => {

    const selectedItem = {
      itemCode: item.itemCode,
      name: item.itemName,
      image: item.imageUrl,
      category: item.category
    }
    
    callItemSelect(selectedItem)
    
    navigation.goBack()
  }

  const filteredResults = selectedCategory 
    ? results.filter(item => item.category === selectedCategory)
    : results

  const Thumbnail = ({ uri, style }) => {
    const [error, setError] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)
    
    if (!uri || error) {
      return (
        <View style={[style, { 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: theme.colors.surfaceVariant 
        }]}>
          <MaterialCommunityIcons
            name="image-off-outline"
            size={viewMode === 'grid' ? 32 : 24}
            color={theme.colors.onSurfaceDisabled}
          />
        </View>
      )
    }
    
    return (
      <View style={style}>
        {imageLoading && (
          <View style={[StyleSheet.absoluteFill, { 
            justifyContent: 'center', 
            alignItems: 'center',
            backgroundColor: theme.colors.surfaceVariant 
          }]}>
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

  const renderListItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.listRow, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleItemSelect(item)}
      activeOpacity={0.7}
    >
      <Thumbnail uri={item.imageUrl} style={styles.listThumb} />
      <View style={styles.listText}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
          {item.itemName}
        </Text>
        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
          {item.category ? `${item.category} • ` : ''}מק"ט: {item.itemCode}
        </Text>
      </View>
      <MaterialCommunityIcons 
        name="plus-circle-outline" 
        size={24} 
        color={theme.colors.primary} 
      />
    </TouchableOpacity>
  )

  const renderGridItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.cardContainer, { 
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outline,
      }]}
      onPress={() => handleItemSelect(item)}
      activeOpacity={0.8}
    >
      <Thumbnail uri={item.imageUrl} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text
          style={[styles.cardTitle, { color: theme.colors.onSurface }]}
          numberOfLines={2}
        >
          {item.itemName}
        </Text>
        {item.category && (
          <Text style={[styles.cardCategory, { color: theme.colors.onSurfaceVariant }]}>
            {item.category}
          </Text>
        )}
      </View>
      <View style={[styles.addButton, { backgroundColor: theme.colors.primary }]}>
        <MaterialCommunityIcons name="plus" size={16} color={theme.colors.onPrimary} />
      </View>
    </TouchableOpacity>
  )

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
      <StatusBar 
        backgroundColor={theme.colors.surface} 
        barStyle={theme.dark ? 'light-content' : 'dark-content'} 
      />
      
      {/* Enhanced Search Header */}
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



        {/* Category Filters */}
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
                    color: selectedCategory === item 
                      ? theme.colors.onPrimary 
                      : theme.colors.onSurface 
                  }}
                >
                  {item}
                </Chip>
              )}
            />
          </View>
        )}
      </Animated.View>

      {/* Results List */}
      <FlatList
        key={`${viewMode}-${selectedCategory}`}
        data={filteredResults}
        keyExtractor={(item, i) => `${item.itemCode}_${i}`}
        renderItem={viewMode === 'list' ? renderListItem : renderGridItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.list,
          filteredResults.length === 0 && styles.emptyList
        ]}
        numColumns={viewMode === 'grid' ? 2 : 1}
        ListEmptyComponent={!loading ? EmptyState : null}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  searchHeader: {
    ...elevation.lg,
    paddingBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  searchbar: {
    flex: 1,
    elevation: 0,
    borderRadius: radius.md,
  },
  viewToggle: {
    borderRadius: radius.md,
  },
  recentsContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  recentsTitle: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
  },
  chip: {
    marginRight: 0,
  },
  categoriesContainer: {
    paddingTop: spacing.md,
  },
  categoriesTitle: {
    ...typography.overline,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
  },
  categoryChip: {
    marginLeft: spacing.sm,
    marginRight: 0,
  },
  list: {
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.title,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: radius.md,
    ...elevation.sm,
  },
  listThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
  },
  listText: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  title: {
    ...typography.subtitle,
  },
  subtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  cardContainer: {
    width: CARD_WIDTH,
    margin: CARD_MARGIN,
    borderRadius: radius.lg,
    ...elevation.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.7,
    borderTopLeftRadius: radius.lg - 1,
    borderTopRightRadius: radius.lg - 1,
  },
  cardContent: {
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 18,
  },
  cardCategory: {
    fontSize: 11,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.md,
  },
})
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, FlatList, View, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native'
import {
  useTheme,
  Card,
  Button,
  Text,
  Paragraph,
  ActivityIndicator,
  IconButton,
  Chip,
  Badge,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { SkeletonList } from '../components/Skeleton';
import { spacing, radius, typography } from '../theme/tokens';

export default function RecommendationsScreen({ route, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listObj } = route.params;
  const { user } = useAuth();

        // Remove bottom tab when navigating to this screen.
        useFocusEffect(
          useCallback(() => {
            const parent = navigation.getParent();
        
            parent?.setOptions({
              tabBarStyle: { display: 'none' },
            });
        
            return () => {
              parent?.setOptions({
                tabBarStyle: undefined,
              });
            };
          }, [])
        );

  const [mainRecs, setMainRecs] = useState([]);
  const [supplementaryAI, setSupplementaryAI] = useState([]);
  const [supplementaryOther, setSupplementaryOther] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showingExtra, setShowingExtra] = useState(false);

  const loadRecs = useCallback(async () => {
    const { data } = await axios.get(
      `/api/Recommendations?listId=${listObj._id}&showAllAI=true`
    );
    if (Array.isArray(data)) {
      setMainRecs(data);
      setSupplementaryAI([]);
      setSupplementaryOther([]);
      setStats({});
    } else {
      setMainRecs(data.main || []);
      const aiItems    = (data.supplementaryAI || []).filter(i => i.method === 'ai');
      const otherItems = (data.supplementaryAI || []).filter(i => i.method !== 'ai');
      setSupplementaryAI(aiItems);
      setSupplementaryOther(otherItems);
      setStats(data.stats || {});
    }
  }, [listObj._id]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await loadRecs(); } catch (err) { console.error(err); }
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try { await loadRecs(); }
      catch (err) { if (active) console.error(err); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false };
  }, [loadRecs]);

  const handleToggleExtra = () => {
    setShowingExtra(!showingExtra);
  };

  const handleAdd = (item) => {
    const selectedItem = {
      itemCode: item.itemCode,
      name: item.name,
      image: item.image,
      category: item.category
    };
    
    // Navigate back to EditItems with the item
    navigation.navigate('EditItems', { 
      listObj,
      addedItem: selectedItem,
      timestamp: Date.now()
    });
  };
    
  const handleDismiss = (code, isSupplementary = false, isAI = false) => {
    if (isSupplementary) {
      if (isAI) {
        setSupplementaryAI(prev => prev.filter(r => r.itemCode !== code));
      } else {
        setSupplementaryOther(prev => prev.filter(r => r.itemCode !== code));
      }
    } else {
      setMainRecs(prev => prev.filter(r => r.itemCode !== code));
    }
  };

  const getMethodIcon = (method) => {
    switch (method) {
      case 'ai': return 'robot';
      case 'habit': return 'calendar';
      case 'co': return 'basket';
      case 'personal': return 'account-circle';
      case 'cf': return 'account-group';
      default: return 'lightbulb-outline';
    }
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'ai': return theme.colors.primary;
      case 'habit': return '#FF9800';
      case 'co': return '#4CAF50';
      case 'personal': return '#9C27B0';
      case 'cf': return '#2196F3';
      default: return theme.colors.outline;
    }
  };

  const renderItem = ({ item }) => {
    const lastDate = item.lastPurchased ? new Date(item.lastPurchased) : null;
    const lastLabel = lastDate
      ? `רכישה אחרונה בתאריך: ${lastDate.toLocaleDateString()}`
      : 'לא נרכש מעולם';

    let methodLabel = '';
    switch (item.method) {
      case 'habit': {
        const todayName = new Date().toLocaleDateString(undefined, { weekday: 'long' });
        methodLabel = `Your usual choice on ${todayName}`;
        break;
      }
      case 'co': methodLabel = 'משתלב טוב ברשימה'; break;
      case 'personal': methodLabel = 'לפי רכישות קודמות'; break;
      case 'cf': methodLabel = 'פופולארי בקרב משתמשים אחרים'; break;
      case 'ai': methodLabel = 'הצעת המערכת'; break;
      default: methodLabel = 'מומלץ';
    }

    const cardStyle = [
      styles.card,
      { backgroundColor: theme.colors.surface },
      item.isSupplementary && { 
        backgroundColor: theme.colors.surfaceVariant,
        borderLeftWidth: 3,
        borderLeftColor: getMethodColor(item.method)
      }
    ];

    return (
      <Card style={cardStyle}>

            <IconButton
              icon="close"
              size={18}
              onPress={() => handleDismiss(item.itemCode, item.isSupplementary, item.method === 'ai')}
              iconColor={theme.colors.outline}
            />
        {item.image && (
          <Card.Cover
            source={{ uri: item.image }}
            style={styles.cardCover}
            resizeMode="cover"
          />
        )}
        <Card.Content style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              <IconButton
                icon={getMethodIcon(item.method)}
                size={20}
                iconColor={getMethodColor(item.method)}
                style={styles.methodIcon}
              />
              <View style={styles.titleContent}>
                <Text variant="titleMedium" style={styles.itemTitle}>
                  {item.name}
                </Text>
                <Text variant="bodySmall" style={[styles.methodLabel, { color: theme.colors.onSurfaceVariant }]}>
                  {methodLabel}
                </Text>
              </View>
              {item.isSupplementary && (
                <Chip 
                  mode="outlined" 
                  compact 
                  style={[styles.extraChip, { borderColor: getMethodColor(item.method) }]}
                  textStyle={{ lineHeight: 10, fontSize: 10, color: getMethodColor(item.method) }}
                >
                  Extra
                </Chip>
              )}
            </View>

          </View>

          {item.method === 'ai' && item.suggestionReason && (
            <View style={styles.reasonContainer}>
              <Text variant="bodySmall" style={[styles.reasonText, { color: theme.colors.onSurfaceVariant }]}>
                "{item.suggestionReason}"
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text variant="bodySmall" style={[styles.dateText, { color: theme.colors.outline }]}>
              {lastLabel}
            </Text>
            <Button
              mode="contained"
              compact
              onPress={() => handleAdd(item)}
              style={styles.addButton}
            >
              הוספה
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const totalExtra = supplementaryAI.length + supplementaryOther.length;
  const aiCount = supplementaryAI.length;
  const otherCount = supplementaryOther.length;

  const allData = [
    ...mainRecs,
    ...(showingExtra ? [...supplementaryAI, ...supplementaryOther] : [])
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={{ paddingTop: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Text style={[typography.body, { color: theme.colors.onSurfaceVariant, marginBottom: spacing.md, textAlign: 'center' }]}>
            מוצא את ההצעות הטובות ביותר...
          </Text>
          <SkeletonList count={4} variant="row" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={allData}
        keyExtractor={item => `${item.itemCode}-${item.isSupplementary ? 'supp' : 'main'}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 60 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListHeaderComponent={() => (
          <View style={styles.header}>
            {/* Compact Stats */}
            {stats.totalAIGenerated > 0 && (
              <View style={styles.compactStats}>
                <View style={styles.statItem}>
                  <IconButton icon="robot" size={16} iconColor={theme.colors.primary} style={styles.statIcon} />
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {stats.totalAIGenerated} AI suggestions
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>•</Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {stats.aiUsedInMain || 0} in main list
                </Text>
              </View>
            )}

            {/* Single Toggle Button */}
            {totalExtra > 0 && (
              <View style={styles.toggleButtonContainer}>
                <Button
                  mode={showingExtra ? "contained" : "outlined"}
                  onPress={handleToggleExtra}
                  icon={showingExtra ? "eye-off" : "eye"}
                  style={styles.toggleButton}
                >
                  {showingExtra 
                    ? `Hide Extra Ideas (${totalExtra})` 
                    : `Show More Ideas (${totalExtra})`
                  }
                  {!showingExtra && aiCount > 0 && ` • ${aiCount} AI`}
                </Button>
              </View>
            )}

            <Text variant="headlineSmall" style={[styles.sectionTitle, theme.text]}>
              {showingExtra && allData.some(item => item.isSupplementary) 
                ? "כל ההמלצות" 
                : "המלצות רשימה"
              }
            </Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <IconButton 
              icon="lightbulb-outline" 
              size={48} 
              iconColor={theme.colors.outline}
            />
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              No recommendations yet
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8 }}>
              Add some items to your list to get personalized suggestions
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16 },
  loader: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    gap: 16
  },
  loadingText: {
    marginTop: 8,
  },
  header: {
    marginBottom: 16,
  },
  compactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    margin: 0,
  },
  toggleButtonContainer: {
    marginBottom: 16,
  },
  toggleButton: {
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
    overflow: 'hidden',
  },
  cardCover: {
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    margin: 0,
    marginRight: 8,
  },
  titleContent: {
    flex: 1,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  methodLabel: {
    fontSize: 12,
  },
  extraChip: {
    height: 24,
    marginLeft: 8,
    
  },
  reasonContainer: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  reasonText: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    flex: 1,
  },
  addButton: {
    borderRadius: 20,
  },
  emptyContainer: { 
    marginTop: 60, 
    alignItems: 'center',
    paddingHorizontal: 32,
  },
});
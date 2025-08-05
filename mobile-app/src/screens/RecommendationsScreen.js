import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, FlatList, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native'
import {
  useTheme,
  Card,
  Button,
  Text,
  ActivityIndicator,
  IconButton,
  Chip,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

export default function RecommendationsScreen({ route, navigation }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { listObj } = route.params;
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent();
      parent?.setOptions({ tabBarStyle: { display: 'none' } });
      return () => parent?.setOptions({ tabBarStyle: undefined });
    }, [])
  );

  const [mainRecs, setMainRecs] = useState([]);
  const [supplementaryAI, setSupplementaryAI] = useState([]);
  const [supplementaryOther, setSupplementaryOther] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showingExtra, setShowingExtra] = useState(false);

  const [selectedCodes, setSelectedCodes] = useState(new Set());

  const fetchRecommendations = async (showAllAI = false) => {
    try {
      const { data } = await axios.get(
        `/api/Recommendations?listId=${listObj._id}&showAllAI=${showAllAI}`
      );
      
      if (Array.isArray(data)) {
        setMainRecs(data);
        setSupplementaryAI([]);
        setSupplementaryOther([]);
        setStats({});
      } else {
        setMainRecs(data.main || []);
        const aiItems = (data.supplementaryAI || []).filter(item => item.method === 'ai');
        const otherItems = (data.supplementaryAI || []).filter(item => item.method !== 'ai');
        setSupplementaryAI(aiItems);
        setSupplementaryOther(otherItems);
        setStats(data.stats || {});
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchRecommendations(true);
      setLoading(false);
    })();
  }, [listObj._id]);

  const handleToggleExtra = () => setShowingExtra(!showingExtra);

  const handleAdd = async (item) => {
    const code = String(item.itemCode);
    if (selectedCodes.has(code)) {
      setSelectedCodes(prev => {
        const next = new Set(prev);
        next.delete(code);
        return next;
      });
      return;
    }
    try {
      const productPayload = {
        itemCode: item.itemCode,
        name: item.name,
        image: item.image || ''
      };
      await axios.put(`/api/ShoppingLists/${listObj._id}`, {
        changes: [{ action: 'added', product: productPayload }]
      });
      setSelectedCodes(prev => new Set(prev).add(code));
    } catch (e) {
    }
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
    // also clear local selection if dismissed
    setSelectedCodes(prev => {
      const next = new Set(prev);
      next.delete(String(code));
      return next;
    });
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

    // is selected
    const isSelected = selectedCodes.has(String(item.itemCode));

    const cardStyle = [
      styles.card,
      { backgroundColor: theme.colors.surface },
      item.isSupplementary && { 
        backgroundColor: theme.colors.surfaceVariant,
        borderLeftWidth: 3,
        borderLeftColor: getMethodColor(item.method)
      },
      // selected highlight
      isSelected && { borderWidth: 2, borderColor: theme.colors.primary }
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
              mode={isSelected ? 'contained' : 'outlined'}
              compact
              icon={isSelected ? 'check' : undefined}
              onPress={() => handleAdd(item)}
              style={styles.addButton}
            >
              {isSelected ? 'נוסף' : 'הוספה'}
            </Button>
          </View>
        </Card.Content>
      </Card>
    );
  };

  const totalExtra = supplementaryAI.length + supplementaryOther.length;
  const aiCount = supplementaryAI.length;
  const allData = [
    ...mainRecs,
    ...(showingExtra ? [...supplementaryAI, ...supplementaryOther] : [])
  ];

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
          מוצא את ההצעות הטובות ביותר...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={allData}
        keyExtractor={item => `${item.itemCode}-${item.isSupplementary ? 'supp' : 'main'}`}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 60 }]}
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

            {/* Header actions */}
            <View style={styles.actionsRow}>
              {totalExtra > 0 && (
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
              )}
            </View>

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
  loadingText: { marginTop: 8 },
  header: { marginBottom: 16 },
  compactStats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12, gap: 8
  },
  statItem: { flexDirection: 'row', alignItems: 'center' },
  statIcon: { margin: 0 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, // Centered
  sectionTitle: { fontWeight: 'bold', marginBottom: 8 },
  card: {
    marginBottom: 12, borderRadius: 12, elevation: 2, overflow: 'hidden'
  },
  cardCover: { height: 120, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  methodIcon: { margin: 0, marginRight: 8 },
  titleContent: { flex: 1 },
  itemTitle: { fontWeight: '600', marginBottom: 2 },
  methodLabel: { fontSize: 12 },
  extraChip: { height: 24, marginLeft: 8 },
  reasonContainer: { backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: 12, marginBottom: 12 },
  reasonText: { fontStyle: 'italic', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateText: { fontSize: 11, flex: 1 },
  addButton: { borderRadius: 20 },
  emptyContainer: { marginTop: 60, alignItems: 'center', paddingHorizontal: 32 },
});

import React, {useState, useEffect, useCallback} from 'react';
import { SafeAreaView, View, TouchableOpacity } from 'react-native';
import { Snackbar, useTheme, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import makeGlobalStyles from '../styles/globalStyles';
import fetchNearestStores from '../utils/fetchNearestStores';
import GetAddressModal from '../components/GetAddressModal';
import { API_BASE } from '../config';
import { useAuth } from '../contexts/AuthContext'
import { useFocusEffect } from '@react-navigation/native';

import { FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Surface, Divider, TouchableRipple } from 'react-native-paper';

MaterialCommunityIcons.loadFont();
axios.defaults.baseURL = API_BASE;

function relTime(ts) {
  try {
    const d = new Date(ts);
    const diff = Math.max(0, Date.now() - d.getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'הרגע';
    if (m < 60) return `לפני ${m} דק׳`;
    const h = Math.floor(m / 60);
    if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
    const days = Math.floor(h / 24);
    return days === 1 ? 'אתמול' : `לפני ${days} ימים`;
  } catch { return ''; }
}

export default function HomeScreen() {

  const theme = useTheme();
  const styles = makeGlobalStyles(theme);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const welcomeBg = theme.colors.surfaceVariant || theme.colors.surface;
  const welcomeFg = theme.colors.onSurface || '#000';
  const welcomeBorder = theme.colors.outlineVariant || 'rgba(0,0,0,0.1)';

  const navigation = useNavigation();

  const [lists, setLists] = useState([]);
  const [mostRecentChange, setMostRecentChange] = useState(null);
  const [recentChanges, setRecentChanges] = useState([]);
  const [addedTo, setAddedTo] = useState([]);

  const [isModalVisible, setModalVisible] = useState(false);
  const addLocation = () => setModalVisible(true);
  const closeModal = () => setModalVisible(false);

  const getCoordinatesFromAddress = async function (address, locationName) {
    try {
      const geocoded = await Location.geocodeAsync(address);
      if (geocoded.length > 0) {
        const { latitude, longitude } = geocoded[0];
        getAddressNearestStores(latitude, longitude, address, locationName);

      } else {
        setErrorMsg('Address not found.');

      }
    } catch (error) {
      console.error(error);
      setErrorMsg('Error getting location.');
    }
  };

  const getAddressNearestStores = async function (latVal, longVal, address, locationName) {
    try {
      const storesData = await fetchNearestStores(latVal, longVal);
      console.log('got stores');
      saveNearestStoresLocally(address, locationName, storesData);

    } catch (err) {
      console.error('Error locating stores:', err);
    }
  };

  const saveNearestStoresLocally = async function (address, locationName, storesData) {
      try {
        const locationStoresData = JSON.stringify({locationAddress: address, nearestStores: storesData});
        const key = '@' + user.id + "_location-stores:" + locationName;
        await AsyncStorage.setItem(key, locationStoresData);
        console.log('Token saved!');
      } catch (e) {
        console.error('Saving error', e);
      }
    };

  const userIdStr = (user?.id || user?._id || '').toString();
  const deriveFeeds = useCallback((all) => {
    const changes = [];
    const added = [];
    for (const l of all) {
      const log = Array.isArray(l.editLog) ? l.editLog : [];
      for (const ev of log) {
        const a = ev.action;
        if (a === 'added' || a === 'removed' || a === 'updated') {
          const ts = ev.timeStamp || ev.ts || ev.time || l.updatedAt;
          const by = ev.changedBy || ev.user || '';
          if (ts) changes.push({ listObj: l, listId: l._id, listTitle: l.title || '', changedBy: by, timeStamp: ts });
        }
        if (a === 'member-added' && (String(ev.targetUser) === userIdStr)) {
          const ts = ev.timeStamp || ev.ts || l.createdAt;
          const by = ev.changedBy || '';
          if (ts) added.push({ listObj: l, listId: l._id, listTitle: l.title || '', changedBy: by, timeStamp: ts });
        }
      }
    }
    changes.sort((x, y) => new Date(y.timeStamp) - new Date(x.timeStamp));
    added.sort((x, y) => new Date(y.timeStamp) - new Date(x.timeStamp));
    setMostRecentChange(changes[0] || null);
    setRecentChanges(changes.slice(0, 5));
    setAddedTo(added.slice(0, 5));
  }, [userIdStr]);

  const fetchListsForHome = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/ShoppingLists');
      setLists(data || []);
      deriveFeeds(data || []);
    } catch {}
  }, [deriveFeeds]);

  useFocusEffect(useCallback(() => {
    fetchListsForHome();
  }, [fetchListsForHome]));

  const renderRecentRow = (item, index, arrLen) => (
    <TouchableRipple
      onPress={() =>
        navigation.navigate('ShopList', {
          screen: 'EditItems',
          params: { listObj: item.listObj }
        })
      }
      rippleColor={theme.colors.primaryContainer}
      style={{ paddingHorizontal: 12 }}
    >
      <View style={{ paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.colors.onSurface, fontSize: 15, textAlign: 'right', flex: 1 }}>{item.listTitle}</Text>
        </View>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 2, textAlign: 'right' }}>{`שונתה ע״י ${item.changedBy || 'מישהו'} • ${relTime(item.timeStamp)}`}</Text>
      </View>
    </TouchableRipple>
  );

  const renderAddedRow = (item, index, arrLen) => (
    <TouchableRipple
      onPress={() =>
        navigation.navigate('ShopList', {
          screen: 'EditItems',
          params: { listObj: item.listObj }
        })
      }
      rippleColor={theme.colors.primaryContainer}
      style={{ paddingHorizontal: 12 }}
    >
      <View style={{ paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.colors.onSurface, fontSize: 15, textAlign: 'right', flex: 1 }}>{item.listTitle}</Text>
        </View>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, marginTop: 2, textAlign: 'right' }}>{`נוספת ע״י ${item.changedBy || 'מישהו'} • ${relTime(item.timeStamp)}`}</Text>
      </View>
    </TouchableRipple>
  );

  const Section = ({ icon, title, children }) => (
    <Surface
      elevation={2}
      style={{
        marginHorizontal: 12,
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: theme.colors.surface
      }}
    >
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
        <MaterialCommunityIcons name={icon} size={18} color={theme.colors.primary} style={{ marginLeft: 8 }} />
        <Text style={{ color: theme.colors.onSurface, fontSize: 16, fontWeight: '700', textAlign: 'right' }}>{title}</Text>
      </View>
      <Divider />
      {children}
    </Surface>
  );

  const displayName = user?.username || user?.email || '';

  return (
    <SafeAreaView style={styles.container}>
      <GetAddressModal isVisible={isModalVisible} onClose={closeModal} fetchLocation={getCoordinatesFromAddress}/>

      {/* Greeting block */}
<Surface
  elevation={2}
  style={{
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: welcomeBg,
    borderWidth: 1,
    borderColor: welcomeBorder
  }}
>
  <View
    style={{
      width: '100%',
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <MaterialCommunityIcons
      name="hand-wave-outline"
      size={20}
      color={welcomeFg}
      style={{ marginLeft: 8 }}
    />
    <Text
      style={{
        color: welcomeFg,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
        includeFontPadding: false
      }}
    >
      {`ברוך הבא, ${displayName}`}
    </Text>
  </View>
</Surface>



      <Section icon="account-plus-outline" title="הוסיפו אותך לרשימות">
        <FlatList
          data={addedTo}
          keyExtractor={(i, idx) => (i.listId || '') + '_add_' + idx}
          renderItem={({ item, index }) => (
            <>
              {renderAddedRow(item, index, addedTo.length)}
              {index < addedTo.length - 1 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
            </>
          )}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 12 }}>
              אין נתונים להצגה עדיין.
            </Text>
          }
        />
      </Section>

      <Section icon="history" title="שינויים אחרונים">
        <FlatList
          data={recentChanges}
          keyExtractor={(i, idx) => (i.listId || '') + '_chg_' + idx}
          renderItem={({ item, index }) => (
            <>
              {renderRecentRow(item, index, recentChanges.length)}
              {index < recentChanges.length - 1 ? <Divider style={{ marginHorizontal: 12 }} /> : null}
            </>
          )}
          ListEmptyComponent={
            <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 12 }}>
              אין נתונים להצגה עדיין.
            </Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        />
      </Section>

      <TouchableOpacity onPress={addLocation}
          style={[{ position: 'absolute', right: 20, padding: 16, borderWidth: 2, borderRadius: 20, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 12 }, { bottom: insets.bottom + 80, backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}
        >
        <MaterialCommunityIcons 
                    name="map-marker-plus" 
                    size={20} 
                    color={theme.colors.onPrimary} 
                  />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

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

MaterialCommunityIcons.loadFont();
axios.defaults.baseURL = API_BASE;

export default function HomeScreen() {

  const theme = useTheme();
  const styles = makeGlobalStyles(theme);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();


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
        // location-stores is added as a prefix to help filter such keys from other locally stores data.
        await AsyncStorage.setItem(key, locationStoresData);
        console.log('Token saved!');
      } catch (e) {
        console.error('Saving error', e);
      }
    };
  

  return (
    <SafeAreaView style={styles.container}>
      <GetAddressModal isVisible={isModalVisible} onClose={closeModal} fetchLocation={getCoordinatesFromAddress}/>
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
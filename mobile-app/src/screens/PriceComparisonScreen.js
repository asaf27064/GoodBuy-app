import React, { useState, useEffect, useCallback } from 'react';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View,SafeAreaView, FlatList, TouchableOpacity, StyleSheet} from 'react-native';
import { useTheme, Text, Checkbox, Card } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import makeGlobalStyles from '../styles/globalStyles';
import {COLORS} from '../styles/colors';
import comparePrices from '../utils/comparePrices';
import getCurrentLocation from '../utils/getCurrentLocation';
import BouncyCheckbox from "react-native-bouncy-checkbox";
import PriceCompScreenItem from '../components/PriceCompStoreItem';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../config';
import fetchNearestStores from '../utils/fetchNearestStores';
import { LoadingIndicator } from '../components/LoadingIndicator';

const NUM_PAGES = 3; // define number of pages in multi-page form.

axios.defaults.baseURL = API_BASE;


function PriceComparisonScreen({route}) {

  const navigation = useNavigation();
  const theme = useTheme();
  const globalStyles = makeGlobalStyles(theme);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const LOCAL_STORAGE_IDENTIFIER = "@" + user.id + "_location-stores:"; // define this screen's key prefix for relevant local data.


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

  const [page, setPage] = useState(1);
  const totalPages = NUM_PAGES;

  const handlePageForward = async function() {
    switch(page) {
      case 1: {
        if(!checkedLocation) {
          alert("You must select a location from the list.");
          return;
        }
        break;
      }
      
      case 2: {
        if (!nearestStores.length) {
          alert("No stores available yet");
          return;
        }

        if (!comparisonMode) {
          alert("Please select a comparison mode");
          return;
        }
        await priceComparator();
        break;
      }
 
      case 3: {
        navigation.goBack();
        break;
      }
 
      default:
        console.log(page);
    }
    setPage(prevStep => Math.min(prevStep + 1, totalPages));
 };

  const handlePageBack = () => {
    setPage(prevStep => Math.max(prevStep - 1, 1));
  };

  const [comparisonMode, setComparisonMode] = useState(null);

  const handleModeSelection = (mode) => {

    setComparisonMode(mode);
  };

    const [nearestStores, setNearestStores] = useState([]);

    const listObj = route.params.listObj;

    const listProducts = listObj.products;

    
    const renderItem = ({ item }) => {

      const currLocationName = (checkedLocation.startsWith(LOCAL_STORAGE_IDENTIFIER)) ? checkedLocation.substring(LOCAL_STORAGE_IDENTIFIER.length) : checkedLocation;
      if (item) {
        
        return (
          <PriceCompScreenItem
          type={item.optionType}
          reason={item.reason}
          stores={item.stores}
          productPrices={item.productPrices.filter(productPrice => productPrice.unitPrice != null)}
          missingItems={item.productPrices.filter(productPrice => productPrice.unitPrice == null)}
          storeItemMap={item.storeItemMap}/*This field is only relevant for type "multi"*/
          currLocation={currLocationName}/>
        );
      } else {
        return null;
      }
    };

    const priceComparator = async function() {
      
      const storesIdsAndDist = nearestStores.map((item) => {return {storeId: item.store._id.$oid, distance: item.distance}});
      const productIdsAndAmount = {};

      
      for (const product of listProducts) {
        productIdsAndAmount[product.product.itemCode] = {name: product.product.name, amount: product.numUnits};
      }
      


      try {
        const response = await axios.get('/api/Products/list_price',
         {params: {stores: JSON.stringify(storesIdsAndDist), products: JSON.stringify(productIdsAndAmount)}});

        const compOutput = comparePrices(response.data, comparisonMode);


        const outputModified = compOutput.map(result => ({...result, 
          stores: result.storeIds.map(storeId => nearestStores.find(store => store.store._id.$oid == storeId))}));

        setComparisonResults(outputModified);

      } catch (err) {
        console.error('Error fetching product prices from stores:', err);

      }

    }

    // Allows user to select from saved locations defined in the home screen.
    const [savedLocations, setSavedLocations] = useState([]);

    useEffect(() => {
      const fetchLocations = async () => {
        try {
          //const { latitude, longitude } = await getCurrentLocation();

          const locationName = "מיקום נוכחי";
          const currLocNearestStores = [];
          const locationInfo = [locationName, { locationAddress: "", nearestStores: currLocNearestStores, loading: true}];

          const allKeys = await AsyncStorage.getAllKeys();
          const locationStoreKeys = allKeys.filter(key => key.startsWith(LOCAL_STORAGE_IDENTIFIER));

          const tmpKeysValues = await AsyncStorage.multiGet(locationStoreKeys);
          const locationStoreKeysValues = tmpKeysValues.map(([key, val]) => [key, JSON.parse(val)]);
    
          setSavedLocations([locationInfo, ...locationStoreKeysValues]);
        } catch (error) {
          console.error('Error fetching locations', error);
        }
      };

      const updateCurrentLocation = async () => {

        try {
          const { latitude, longitude } = await getCurrentLocation();

          const locationName = "מיקום נוכחי";
          const currLocNearestStores = await fetchNearestStores(latitude, longitude);
          const updatedLocationInfo = [locationName, { locationAddress: "", nearestStores: currLocNearestStores, loading: false }];

          setSavedLocations(prev =>
            prev.map(loc =>
              loc[0] === 'מיקום נוכחי' ? updatedLocationInfo : loc
            )
            
          );

        } catch (error) {
          console.error('Error updating current location', error);

        }
      }
    
      fetchLocations();
      updateCurrentLocation();

    }, []);

    const [checkedLocation, setCheckedLocation] = useState(null);

    const renderLocationList = ({item}) => {

      const locKey = item[0];
      const locName = (locKey.startsWith(LOCAL_STORAGE_IDENTIFIER)) ? locKey.substring(LOCAL_STORAGE_IDENTIFIER.length) : locKey;
      const locAddress = item[1].locationAddress;
      const locNearestStores = item[1].nearestStores;
      const checkboxLabel = (item[1].loading) ? locName + '\n' + locAddress + "(מחפש חנויות קרובות...)" : locName + '\n' + locAddress

      return (
        <Card style={styles.card}>
          <Card.Content>
            <Checkbox.Item
              label={checkboxLabel}
              position="leading"
              status={checkedLocation === locKey ? 'checked' : 'unchecked'}
              disabled={locKey === "מיקום נוכחי" && item[1].loading}
              onPress={() => {

                setCheckedLocation(locKey);
                setNearestStores(locNearestStores);
              }}
            />
          </Card.Content>
        </Card>
      );
    };


    const [comparisonResults, setComparisonResults] = useState([]);


    return (
        <SafeAreaView style={globalStyles.container}>

          <View style={{flex: 1}}>
            {page === 1 && (
              <View>
                <Text style={[theme.headlineMedium, theme.text, {margin: 10}]}>בחר נקודת מוצא לחישוב השוואת המחירים:</Text>
                {savedLocations.length > 0 && (
                    <FlatList 
                    data={savedLocations}
                    keyExtractor={(item) => item[0] /* The key used in AsyncStorage will be here, and therefore must be unique*/}
                    renderItem={renderLocationList}
                    />
                )}
              </View>
              )}

            {page === 2 && (

              <View style={styles.optionContainer}>
                <Text style={[theme.headlineMedium, theme.text]}>
                  בחר את ההעדפה שלך:{'\n'}
                </Text>

                  <Checkbox.Item
                    label="אני רוצה לקנות במחיר המשתלם ביותר"
                    status={comparisonMode === 'favor_price' ? 'checked' : 'unchecked'}
                    onPress={() => {
                      handleModeSelection('favor_price');
                    }}
                    />
                  <Checkbox.Item
                    label="אני צריך כמה שיותר מוצרים מהרשימה "
                    status={comparisonMode === 'favor_completeness' ? 'checked' : 'unchecked'}
                    onPress={() => {
                      handleModeSelection('favor_completeness');
                    }}
                  />

              </View>
            )}

            {page === 3 && comparisonResults.length > 0 ? (
              <FlatList
                data={comparisonResults}
                renderItem={renderItem}
              />
            ) : (
              page === 3 && <Text>לא מצאנו חנויות משתלמות לקנות מהן. נסה לבחור מיקום אחר.</Text>
            )}
          </View>

        <View style={[styles.buttonsContainer, { paddingBottom: insets.bottom + 40 }]}>
        {page > 1 && (
          <TouchableOpacity onPress={handlePageBack} style={[styles.button, styles.backButton]}>
            <Text>חזור</Text>
          </TouchableOpacity>
        )}
        {page < NUM_PAGES ? (
          <TouchableOpacity onPress={handlePageForward} style={[styles.button, styles.nextButton]}>
            <Text>הבא</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handlePageForward} style={[styles.button, styles.nextButton]}>
            <Text>סיום</Text>
          </TouchableOpacity>
        )}
      </View>

      </SafeAreaView>
    );
}

const styles = StyleSheet.create({
  contentContainer: {
      flex: 1,
      
  },
  optionContainer: {
    flex: 1,
    padding: 10,
    margin: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
   buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 50,
    margin: 10,
  }, 
  button: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: COLORS.goodBuyGreen
  },
  card: { marginHorizontal: 12, marginVertical: 6, borderRadius: 8, elevation: 2 },
}
)

export default PriceComparisonScreen;
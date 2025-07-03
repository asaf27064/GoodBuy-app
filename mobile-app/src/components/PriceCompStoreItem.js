import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Card,
  useTheme,
  Text,
  Portal,
  Modal,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons'; // or use 'react-native-vector-icons/MaterialCommunityIcons'
import { DisplayStoreProductsModal } from './DisplayStoreProductsModal';
import globalStyles from '../styles/globalStyles';
import { COLORS } from '../styles/colors';


const PriceCompScreenItem = ({type, reason, stores, productPrices, missingItems, storeItemMap, currLocation}) => {

    const theme = useTheme();
    const totalPrice = productPrices.reduce((partialSum, product) => partialSum + (product.unitPrice * product.amount), 0);

    const formatDistance = (distance) => {return "במרחק " + distance + " מ" + currLocation};

    const pulseAnim = useRef(new Animated.Value(1)).current;
      
    useEffect(() => {
      if (missingItems.length > 0) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    }, [missingItems.length]);

    if (type == 'single') {
        const store = stores[0];
        const storeTitle = (store.store.subChainName == "") ? store.store.storeName : (store.store.storeName + " (" + store.store.subChainName + ")");
        const distanceText = (store.distance < 1.0) ? ((store.distance) * 1000).toFixed(0)  + " מטר" :  (store.distance).toFixed(2) + " קילומטר";

        const [productListModalVisible, setProductListModalVisible] = useState(false);
        const closeProductListModal = () => setProductListModalVisible(false);

        const [missingItemsModalVisible, setMissingItemsModalVisible] = useState(false);
        const closeMissingItemsModal = () => setMissingItemsModalVisible(false);
      

        return (
        <>
          <Card style={[styles.optionContainer, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
              {reason === 'nearest' && (
                <Text style={[theme.headlineMedium, theme.text]}>
                  אופציה קרובה: {storeTitle}
                </Text>
              )}
              {reason === 'best' && (
                <Text style={[theme.headlineMedium, theme.text]}>
                  רכישה משתלמת ביותר בחנות אחת:{'\n'} {storeTitle}
                </Text>
              )}
              <Text style={[theme.text]}> {formatDistance(distanceText)}</Text>
              <Text style={[theme.text]}s>
                כתובת: {store.store.address}, {store.store.city}
              </Text >
              <Text style={[theme.text]}>מחיר סה"כ: {totalPrice.toFixed(2)}</Text>
            </Card.Content>

            <Card.Content>
              <View style={styles.buttonsContainer}>
                {/* Display List Button */}
                <TouchableOpacity
                  onPress={() => setProductListModalVisible(true)}
                >
                  <MaterialCommunityIcons
                    name="format-list-bulleted"
                    size={28}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>

                {/* Missing Items Button */}
                {missingItems.length > 0 && (
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                      onPress={() => setMissingItemsModalVisible(true)}
                    >
                      <MaterialCommunityIcons
                        name="alert-circle-outline"
                        size={28}
                        color={theme.colors.warning}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>
            </Card.Content>
          </Card>

        <DisplayStoreProductsModal isVisible={productListModalVisible} onClose={closeProductListModal} productsToDisplay={productPrices} missingListFlag={false}/>
        <DisplayStoreProductsModal isVisible={missingItemsModalVisible} onClose={closeMissingItemsModal} productsToDisplay={missingItems} missingListFlag={true}/>
    </>
  );
    } else if (type == 'multi') {

    const [store1, store2] = [stores[0], stores[1]];

    const store1Products = productPrices.filter(prod => storeItemMap.buyFromStore1.has(prod.productCode));
    const store2Products = productPrices.filter(prod => storeItemMap.buyFromStore2.has(prod.productCode));

    const store1Title = (store1.store.subChainName == "") ? store1.store.storeName : (store1.store.storeName + " (" + store1.store.subChainName + ")");
    const store1DistanceText = (store1.distance < 1.0) ? ((store1.distance) * 1000).toFixed(0)  + " מטר" :  (store1.distance).toFixed(2) + " קילומטר";

    const store2Title = (store2.store.subChainName == "") ? store2.store.storeName : (store2.store.storeName + " (" + store2.store.subChainName + ")");
    const store2DistanceText = (store2.distance < 1.0) ? ((store2.distance) * 1000).toFixed(0)  + " מטר" :  (store2.distance).toFixed(2) + " קילומטר";

    const [productsStore1ModalVisible, setProductsStore1ModalVisible] = useState(false);
    const closeProductsStore1ModalVisible = () => setProductsStore1ModalVisible(false);

    const [productsStore2ModalVisible, setProductsStore2ModalVisible] = useState(false);
    const closeProductsStore2ModalVisible = () => setProductsStore2ModalVisible(false);

    const [missingItemsModalVisible, setMissingItemsModalVisible] = useState(false);
    const closeMissingItemsModal = () => setMissingItemsModalVisible(false);

    return (
        <Card style={[styles.optionContainer, { backgroundColor: theme.colors.surface }]}>
            <Card.Content>
                <Text variant="titleLarge">
                    רכישה משתלמת ביותר בשתי חנויות:
                </Text>
                <Text>מחיר סה"כ: {totalPrice.toFixed(2)}</Text>
            </Card.Content>
            <Card.Content>
              <View style={styles.storeContainer}>
                                  {/* List1 Button */}
                                  <TouchableOpacity
                        onPress={() => setProductsStore1ModalVisible(true)}
                        >
                        <MaterialCommunityIcons
                            name="format-list-bulleted"
                            size={28}
                            color={theme.colors.primary}
                        />
                    </TouchableOpacity>
                  <View>
                    <Text style={[theme.text]}>
                      {store1Title}
                    </Text>
                    <Text style={[theme.text]}>
                      {formatDistance(store1DistanceText)}
                    </Text >
                    <Text style={[theme.text]}>
                      {store1.store.address}
                    </Text>
                  </View>

                </View>
                <View style={styles.storeContainer}>
                                      {/* List2 Button */}
                                      <TouchableOpacity
                        onPress={() => setProductsStore2ModalVisible(true)}
                    >
                        <MaterialCommunityIcons
                            name="format-list-bulleted"
                            size={28}
                            color={theme.colors.primary}
                        />
                    </TouchableOpacity>
                  <View>
                    <Text style={[theme.text]}>
                      {store2Title}
                    </Text>
                    <Text style={[theme.text]}>
                      {formatDistance(store2DistanceText)}
                    </Text>
                    <Text style={[theme.text]}>
                      {store2.store.address}
                    </Text>
                  </View>

                </View>
            </Card.Content>
            <Card.Content>
                <View style={styles.buttonsContainer}>

                    {/* Missing Items Button */}
                    {missingItems.length > 0 && (
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <TouchableOpacity
                                onPress={() => setMissingItemsModalVisible(true)}
                            >
                                <MaterialCommunityIcons
                                    name="alert-circle-outline"
                                    size={28}
                                    color={theme.colors.warning}
                                />
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>
            </Card.Content>
            <DisplayStoreProductsModal isVisible={productsStore1ModalVisible} onClose={closeProductsStore1ModalVisible} productsToDisplay={store1Products} missingListFlag={false}/>
            <DisplayStoreProductsModal isVisible={productsStore2ModalVisible} onClose={closeProductsStore2ModalVisible} productsToDisplay={store2Products} missingListFlag={false}/>
            <DisplayStoreProductsModal isVisible={missingItemsModalVisible} onClose={closeMissingItemsModal} productsToDisplay={missingItems} missingListFlag={true}/>
        </Card>
    );
    }
}

/*const styles = StyleSheet.create({
        optionContainer: {
            backgroundColor: COLORS.secondaryGray,
            borderRadius: 10,
            padding: 10,
            marginTop: 20
        },

        buttonsContainer: {
            padding: 10,
            marginTop: 5,
            backgroundColor: 'yellow',
            justifyContent: 'space-around',
            flexDirection: 'row'
        }
    }
)*/

const styles = StyleSheet.create({
    optionContainer: {
      borderRadius: 10,
      padding: 10,
      marginTop: 20,
      marginHorizontal: 10,
      elevation: 3,
    },
    storeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: 2
    },
    buttonsContainer: {
      padding: 10,
      margin: 25,
      justifyContent: 'space-around',
      flexDirection: 'row',
    },

    listRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderColor: '#ddd',
    },
  });

export default PriceCompScreenItem;
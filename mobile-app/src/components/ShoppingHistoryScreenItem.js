import React, {useState} from 'react';
import { View, Modal, FlatList, Button, Image, Touchable, TouchableHighlight, StyleSheet, TextInput, TouchableOpacity} from 'react-native';
import globalStyles from '../styles/globalStyles';
import formatDate from '../utils/formatDate';
import  MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import { COLORS } from '../styles/colors';
import {Text, Card, useTheme, Portal} from 'react-native-paper';
import { PurchasedProductsModal } from './PurchasedProductsModal';

const ShoppingHistoryScreenItem = ({title, purchasedProds, timeStamp}) => {


    const theme = useTheme();
    const formatedDate =  formatDate(new Date(timeStamp));

    const [productListModalVisible, setProductListModalVisible] = useState(false);
    const closeProductListModal = () => setProductListModalVisible(false);

    const renderItem = ({item}) => {
        return(
            <View>
            {/*<Image source={{uri: item.image}} style={styles.prodPic}/>
            <View>
                <Text style={[theme.headlineMedium]}>{item.name}</Text>
        </View>*/}
            </View>
        );
    }


    return (
        <>
        <Card style={styles.card}>
            <View style={styles.container}>
            <Card.Content>
                <TouchableOpacity onPress={() => setProductListModalVisible(true)}>
                    <MaterialCommunityIcons
                        name="format-list-bulleted"
                        size={28}
                        color={theme.colors.primary}
                        />
                </TouchableOpacity>
            </Card.Content>
            <Card.Content>
                <Text style={[theme.headlineMedium, theme.text]}>{title}</Text>
                <Text style={[theme.text]}> הרכישה בוצעה ב-{formatedDate}</Text>
            </Card.Content>
            </View>
        </Card>
        <PurchasedProductsModal 
        isVisible={productListModalVisible} 
        onClose={closeProductListModal}  
        productsToDisplay={purchasedProds}></PurchasedProductsModal>
        
    </>
    );
}

const styles = StyleSheet.create({
        container: {
            borderRadius: 10,
            marginBottom: 10,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
        },

        prodPic: {
            flex: 1,
            alignItems: 'center',
            width: '100%',
            height: undefined,
            aspectRatio: 1,
        },

        editDetails: {
            flex: 3,
            flexDirection: 'column',
            marginLeft: 10,
        }, 
        modalContainer: {
            backgroundColor: 'white',
            padding: 20,
            marginHorizontal: 20,
            borderRadius: 10,
            maxHeight: '50%'
          },
          card: { marginHorizontal: 12, marginVertical: 6, borderRadius: 8, elevation: 2 },

    }
)

export default ShoppingHistoryScreenItem;
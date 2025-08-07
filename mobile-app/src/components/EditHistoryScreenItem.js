import React, {useState} from 'react';
import { View, Button, Image, Touchable, TouchableHighlight, StyleSheet, TextInput} from 'react-native';
import globalStyles from '../styles/globalStyles';
import formatDate from '../utils/formatDate';
import  MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons"
import { COLORS } from '../styles/colors';
import {Text, useTheme} from 'react-native-paper';

const EditHistoryScreenItem = ({changedProd, changedBy, action, timeStamp, difference}) => {


    const theme = useTheme();
    
    const defineActionDependantParams = (action) => {

        let color = 'white';
        let actionName = '';
        if (action === "added") {
            color = COLORS.muteGreen;
            actionName = "הוסף";
        } else if (action === "removed") {
            color = COLORS.muteRed;
            actionName = "הוסר";
        } else if (action === "updated") {
            color = COLORS.muteYellow;
            actionName = "עודכן";
        }
        
        return [color, actionName];
    }

    const [bgColor, actionName] = defineActionDependantParams(action);
    const formatedDate =  formatDate(new Date(timeStamp));


    return (
        <View style={[styles.container, {backgroundColor: bgColor}]}>
            <Image source={{uri: changedProd.image}} style={styles.prodPic}/>
            <View style={styles.editDetails}>
                <Text style={[theme.headlineMedium, theme.text]}>{changedProd.name.trim()}</Text>
                <Text style={[theme.text]}>{actionName} ע"י {changedBy} ב-{formatedDate}</Text>
                {action === "updated" && (
                    <Text style={[theme.text]}> שינוי כמות: {difference.toString()}</Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
        container: {
            borderRadius: 10,
            marginBottom: 10,
            padding: 10,
            flexDirection: 'row'
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
        }

    }
)

export default EditHistoryScreenItem;
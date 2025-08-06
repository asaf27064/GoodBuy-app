import React, { useState, useCallback } from 'react';
import {View, FlatList, SafeAreaView, StyleSheet} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from 'react-native-paper';
import makeGlobalStyles from '../styles/globalStyles';
import EditHistoryItem from '../components/EditHistoryScreenItem';

export default function EditHistoryScreen({ route }) {

  const navigation = useNavigation();
  const theme = useTheme();
  const styles = makeStyles(theme);

  // Remove bottom tab and drawer button when navigating to this screen.
  useFocusEffect(
    useCallback(() => {

      navigation.setOptions({
        headerRight: () => null,
      });

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

  const currList = route.params.listObj;
  const [editHistory] = useState(currList.editLog)

  const renderItem = ({ item }) => (
    <View>
      <EditHistoryItem
        changedProd={item.product}
        changedBy={item.changedBy}
        action={item.action}
        timeStamp={item.timeStamp}
      />
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <FlatList data={editHistory} style={styles.editHistoryList} renderItem={renderItem} />
    </SafeAreaView>
  )
}

function makeStyles(theme) {
  const globals = makeGlobalStyles(theme)
  return StyleSheet.create({
    container: {
      ...globals.container
    },
    editHistoryList: {
      paddingVertical: 8,
      marginHorizontal: 12
    }
  })
}
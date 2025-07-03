import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import {
  Card,
  useTheme,
  Text,
  Portal,
  Modal,
  DataTable,
} from 'react-native-paper';
import globalStyles from '../styles/globalStyles';
import { COLORS } from '../styles/colors';

export const DisplayStoreProductsModal = ({isVisible, onClose, productsToDisplay, missingListFlag}) => {



    const renderItem = ({item}) => {

          return(
          <View style={styles.listRow}>
            <Text>{item.name}</Text>
            {item.unitPrice != null && (
            <Text>Unit: {item.unitPrice.toFixed(2)}</Text>
            )}
            <Text>Qty: {item.amount}</Text>
            {item.unitPrice != null && (
            <Text>Total: {(item.unitPrice * item.amount).toFixed(2)}</Text>
            )}
          </View>
          );
    };

    // TODO: make all text centerd, can be done using "jusify-content" for each cell, including header cells.
    return (
        <Portal>
            <Modal
        visible={isVisible}
        onDismiss={() => onClose()}
        contentContainerStyle={styles.modalContainer}
        >
        <Text variant="titleMedium">Products available for purchase</Text>
        <ScrollView style={styles.tableContainer}>
      <DataTable>
        {/* Table Header */}
        <DataTable.Header>
          <DataTable.Title>שם מוצר</DataTable.Title>
          <DataTable.Title numeric>כמות</DataTable.Title>
          {!missingListFlag && (
            <>
                <DataTable.Title numeric>מחיר ליחידה</DataTable.Title>
                <DataTable.Title numeric>סה"כ</DataTable.Title>
            </>
          )}
        </DataTable.Header>

        {/* Table Rows */}
        {productsToDisplay.map((item, index) => {
          return (
            <DataTable.Row key={index} style={styles.tableRow}>
              <DataTable.Cell><Text numberOfLines={0} ellipsizeMode="clip">{item.name}</Text></DataTable.Cell>
              <DataTable.Cell numeric>{item.amount}</DataTable.Cell>
              {!missingListFlag && (
              <>
                <DataTable.Cell numeric>{item.unitPrice.toFixed(2)}</DataTable.Cell>
                <DataTable.Cell numeric>{(item.unitPrice * item.amount).toFixed(2)}</DataTable.Cell>
              </>
              )}
            </DataTable.Row>
          );
        })}
      </DataTable>
    </ScrollView>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        backgroundColor: 'white',
        padding: 20,
        marginHorizontal: 20,
        borderRadius: 10,
        maxHeight: '50%',
      },
      tableRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: '#ddd',
      },
});

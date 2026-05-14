import React, { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native'
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import makeGlobalStyles from '../styles/globalStyles'
import ProductCheckListItem from '../components/CheckListScreenItem'
import ConfirmPurchaseModal from '../components/ConfirmPurchaseModal'
import { useToast } from '../contexts/ToastContext'
import { useT } from '../utils/translations'
import { API_BASE } from '../config'

export default function CheckListScreen({ route, navigation }) {
  const theme = useTheme()
  const styles = makeGlobalStyles(theme)
  const insets = useSafeAreaInsets()
  const { show: toast } = useToast()
  const t = useT()

    // Remove bottom tab when navigating to this screen.
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

  const listObj = route.params.listObj

  // Track which Items were checked by the user.
  const [checkedSet, setCheckedSet] = useState(new Set())
  const unchecked = listObj.products.filter(p => !checkedSet.has(p.product.itemCode))
  const checked   = listObj.products.filter(p =>  checkedSet.has(p.product.itemCode))

  // Pop-up modal for when the user preses "finish purchase".
  const [modalVisible, setModalVisible] = useState(false)


  // Handle check/uncheck of item on the list.
  const toggle = item => {
    const next = new Set(checkedSet)
    const code = item.product.itemCode
    next.has(code) ? next.delete(code) : next.add(code)
    setCheckedSet(next)
  }

  // Upon pressing "finish purchase", add list to user's purchase history.
  // Also empty all items in list and clears its edit history.
  const finishPurchase = async items => {
    try {
      await axios.post(`${API_BASE}/api/Purchases`, {
        listId:            listObj._id,
        timestamp:         Date.now(),
        purchasedProducts: items.map(({ product, numUnits }) => ({ product, numUnits }))
      })
      toast(t('checkListScreen.confirmPurchaseText'), { variant: 'success' })
      setCheckedSet(new Set())
      navigation.goBack()
    } catch (err) {
      toast(err.response?.data?.error || err.message || t('shared.error'), { variant: 'error' })
    } finally {
      setModalVisible(false)
    }
  }

  const renderItem = ({ item }) => (
    <ProductCheckListItem
      product={item}
      checkStatus={checkedSet.has(item.product.itemCode)}
      handleCheck={() => toggle(item)}
    />
  )

  return (
    <SafeAreaView style={styles.container}>
      <ConfirmPurchaseModal
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        purchasedItems={checked}
        handlePurchase={finishPurchase}
        allCheckedFlag={unchecked.length === 0}
      />

      <Text style={[styles.headerText, theme.text, {margin: 10}]}>{t('checkListScreen.unCheckedProductsHeader')}</Text>
      <FlatList
        data={unchecked}
        keyExtractor={(item, idx) => `${item.product.itemCode}-${idx}`}
        renderItem={renderItem}
      />

      {checked.length > 0 && (
        <>
          <Text style={[styles.headerText, theme.text, {margin: 10}]}>{t('checkListScreen.checkedProductsHeader')}</Text>
          <FlatList
            data={checked}
            keyExtractor={(item, idx) => `${item.product.itemCode}-${idx}`}
            renderItem={renderItem}
          />
        </>
      )}

      <TouchableOpacity
        style={[
          styles.addListBtn,
          { bottom: insets.bottom + 70, backgroundColor: theme.colors.primary }
        ]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.text}>{t('checkListScreen.finishPuchaseButtonText')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

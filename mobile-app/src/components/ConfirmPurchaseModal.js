import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import globalStyles from '../styles/globalStyles'


// Pop-up modal asking the user to confirm the "finish-purchase" action.
export default function ConfirmPurchaseModal({isVisible, onClose, purchasedItems, handlePurchase, allCheckedFlag}) {
  

  return (
    <Modal transparent visible={isVisible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <TouchableOpacity onPress={onClose}>
            <Text>✕</Text>
          </TouchableOpacity>
          {
          //prompt will not appear when all items in the checklist are checked.
          !allCheckedFlag && <Text style={styles.warn}>נותרו מוצרים ברשימה שטרם סומנו.</Text>
          }
          <Text style={styles.prompt}>סיימת עם הקניות?</Text>
          <Text style={styles.sub}>
            לחיצה על "אישור" תרוקן את רשימת הקניות ותמחק את היסטוריית העריכה של הרשימה.
          </Text>
          <TouchableOpacity
            style={globalStyles.confirmBtn}
            onPress={() => handlePurchase(purchasedItems)}
          >
            <Text>אישור</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  container: {
    width: '80%', padding: 16, backgroundColor: 'white',
    borderRadius: 8, alignItems: 'center'
  },
  warn: { marginBottom: 8, color: 'tomato' },
  prompt: { fontSize: 16, fontWeight: '600', marginVertical: 8 },
  sub: { fontSize: 12, color: '#555', textAlign: 'center', marginBottom: 16 }
})

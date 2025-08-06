import React, { useState, useEffect, useCallback } from 'react'
import { View, Image, StyleSheet } from 'react-native'
import { Card, IconButton, TextInput, Text, useTheme } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'

function EditListScreenItem({ product, removeProduct, updateQuantity }) {
  const theme = useTheme()
  const MIN = 1
  const MAX = 99
  const [qty, setQty] = useState(product.numUnits)

  useEffect(() => { setQty(product.numUnits) }, [product.numUnits])

  const changeQty = useCallback(delta => {
    const q = Math.min(Math.max(qty + delta, MIN), MAX)
    setQty(q)
    updateQuantity(product, q)
  }, [qty, product, updateQuantity])

  const onInputChange = useCallback(text => {
    const n = parseInt(text, 10)
    const q = isNaN(n) ? MIN : Math.min(Math.max(n, MIN), MAX)
    setQty(q)
    updateQuantity(product, q)
  }, [product, updateQuantity])

  const Thumb = ({ uri, style }) => {
    const [err, setErr] = useState(false)
    if (!uri || err) {
      return (
        <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surfaceVariant }]}>
          <MaterialCommunityIcons name="image-off-outline" size={24} color={theme.colors.onSurfaceDisabled} />
        </View>
      )
    }
    return <Image source={{ uri }} style={style} onError={() => setErr(true)} resizeMode="cover" />
  }

  return (
    <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Card.Content style={styles.row}>
        <Thumb uri={product.product.image} style={styles.image} />
        <View style={styles.info}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{product.product.name}</Text>
          <Text style={[styles.category, { color: theme.colors.onSurfaceVariant }]}>{product.product.category}</Text>
        </View>
        <View style={styles.side}>
          <View style={styles.qtyRow}>
            <IconButton icon="minus" size={20} disabled={qty <= MIN} onPress={() => changeQty(-1)} containerColor="transparent" iconColor={theme.colors.primary} />
            <TextInput
              value={String(qty)}
              onChangeText={onInputChange}
              mode="outlined"
              keyboardType="numeric"
              outlineColor={theme.colors.primary}
              activeOutlineColor={theme.colors.primary}
              style={[styles.input, { backgroundColor: theme.colors.surface }]}
              contentStyle={styles.inputContent}
            />
            <IconButton icon="plus" size={20} disabled={qty >= MAX} onPress={() => changeQty(1)} containerColor="transparent" iconColor={theme.colors.primary} />
          </View>
          <IconButton icon="trash-can-outline" size={20} onPress={() => removeProduct(product)} iconColor={theme.colors.error} containerColor="transparent" style={styles.remove} />
        </View>
      </Card.Content>
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginVertical: 6, borderRadius: 8, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 40, height: 40, borderRadius: 4, marginRight: 8 },
  info: { flex: 1.5, justifyContent: 'center', paddingRight: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  category: { fontSize: 12, marginTop: 2 },
  side: { alignItems: 'center', justifyContent: 'center' },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  input: { width: 40, height: 36, marginHorizontal: 4 },
  inputContent: { paddingVertical: 0, textAlign: 'center', fontSize: 14, justifyContent: 'center', textAlignVertical: 'center' },
  remove: { marginTop: 4 }
})

export default React.memo(EditListScreenItem, (p, n) =>
  p.product.numUnits === n.product.numUnits && p.product.product.itemCode === n.product.product.itemCode
)
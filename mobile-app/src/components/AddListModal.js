import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  TouchableHighlight,
  StyleSheet,
  Dimensions
} from 'react-native'
import axios from 'axios'
import { useTheme, Portal } from 'react-native-paper'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import globalStylesFactory from '../styles/globalStyles'
import { useAuth } from '../contexts/AuthContext'
import { spacing, radius, elevation, typography, MIN_HIT_TARGET } from '../theme/tokens'

const { height: screenHeight, width: screenWidth } = Dimensions.get('window')

export default function AddListModal({ isVisible, onClose, createList }) {
  const theme = useTheme()
  const gs = globalStylesFactory(theme)
  const { user } = useAuth()

  const [titleText, setTitleText] = useState('')
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState([])
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    if (!isVisible) return
    axios
      .get('/api/Users')
      .then(({ data }) => {
        const filtered = Array.isArray(data)
          ? data.filter(u => String(u._id) !== String(user?.id))
          : []
        setUsers(filtered)
      })
      .catch(console.error)
  }, [isVisible, user?.id])

  useEffect(() => {
    if (!isVisible) {
      setSearchText('')
    }
  }, [isVisible])

  const filteredUsers = useMemo(() => {
    if (!searchText.trim()) return users
    
    const searchLower = searchText.toLowerCase()
    return users.filter(u => {
      const username = (u.username || '').toLowerCase()
      const email = (u.email || '').toLowerCase()
      return username.includes(searchLower) || email.includes(searchLower)
    })
  }, [users, searchText])

  const toggleUser = id =>
    setSelected(s =>
      s.includes(id) ? s.filter(x => x !== id) : [...s, id]
    )

  const onSubmit = () => {
    const memberIds = Array.from(new Set([...(selected || []), user.id]))
    createList(titleText, memberIds)
    setTitleText('')
    setSelected([])
    setSearchText('')
    onClose()
  }

  const handleClose = () => {
    setTitleText('')
    setSelected([])
    setSearchText('')
    onClose()
  }

  if (!isVisible) return null

  return (
    <Portal>
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          <TouchableHighlight 
            onPress={handleClose} 
            style={styles.closeButton}
            underlayColor={theme.colors.surfaceVariant}
          >
            <Text style={{ color: theme.colors.onSurface, fontSize: 16 }}>✕</Text>
          </TouchableHighlight>

          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            יצירת רשימה חדשה
          </Text>

          <TextInput
            placeholder="שם רשימה"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={titleText}
            onChangeText={setTitleText}
            style={[styles.input, { 
              borderBottomColor: theme.colors.outline,
              color: theme.colors.onSurface
            }]}
          />

          <Text style={[styles.sectionTitle, theme.text]}>
            הוספת חברים לרשימה
          </Text>

          {/* Search Input */}
          <View style={[styles.searchContainer, { borderColor: theme.colors.outline }]}>
            <MaterialCommunityIcons 
              name="magnify" 
              size={20} 
              color={theme.colors.onSurfaceVariant} 
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="הזן שם משתמש או אימייל..."
              placeholderTextColor={theme.colors.onSurfaceVariant}
              value={searchText}
              onChangeText={setSearchText}
              style={[styles.searchInput, { color: theme.colors.onSurface }]}
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <MaterialCommunityIcons 
                  name="close-circle" 
                  size={20} 
                  color={theme.colors.onSurfaceVariant} 
                />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <View style={styles.userListContainer}>
            <FlatList
              data={filteredUsers}
              keyExtractor={u => u._id}
              showsVerticalScrollIndicator={true}
              ListEmptyComponent={
                <Text style={{ 
                  color: theme.colors.onSurfaceVariant, 
                  textAlign: 'center', 
                  padding: 20 
                }}>
                  {searchText ? 'No users found matching your search.' : 'No other users found.'}
                </Text>
              }
              renderItem={({ item }) => {
                const isSel = selected.includes(item._id)
                const displayName = item.username || item.email
                const secondaryText = item.username ? item.email : null
                
                return (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => toggleUser(item._id)}
                    activeOpacity={0.7}
                  >
                    
                    <View style={styles.userInfo}>
                      <Text style={{ 
                        color: theme.colors.onSurface,
                        fontSize: 14,
                        fontWeight: '500'
                      }}>
                        {displayName}
                      </Text>
                      {secondaryText && (
                        <Text style={{ 
                          color: theme.colors.onSurfaceVariant,
                          fontSize: 12,
                          marginTop: 2
                        }}>
                          {secondaryText}
                        </Text>
                      )}
                    </View>

                    <View
                      style={[styles.checkbox, {
                        borderColor: theme.colors.primary,
                        backgroundColor: isSel ? theme.colors.primary : 'transparent'
                      }]}
                    >
                      {isSel && (
                        <MaterialCommunityIcons 
                          name="check" 
                          size={14} 
                          color={theme.colors.onPrimary} 
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          </View>

          {/* Show selected count */}
          {selected.length > 0 && (
            <Text style={[styles.selectedCount, { color: theme.colors.primary }]}>
              {selected.length} member{selected.length !== 1 ? 's' : ''} selected
            </Text>
          )}

          <TouchableHighlight 
            onPress={onSubmit} 
            style={[
              styles.button, 
              { 
                backgroundColor: titleText.trim() ? theme.colors.primary : theme.colors.surfaceVariant,
                opacity: titleText.trim() ? 1 : 0.6
              }
            ]}
            disabled={!titleText.trim()}
            underlayColor={theme.colors.primaryContainer}
          >
            <Text style={{ 
              color: titleText.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
              fontWeight: '600'
            }}>
              צור רשימה
            </Text>
          </TouchableHighlight>
        </View>
      </View>
    </Portal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  modal: {
    width: screenWidth * 0.9,
    maxWidth: 420,
    maxHeight: screenHeight * 0.85,
    padding: spacing.xl,
    borderRadius: radius.lg,
    ...elevation.xl,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: MIN_HIT_TARGET - 12,
    height: MIN_HIT_TARGET - 12,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  input: {
    borderBottomWidth: 1,
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
    ...typography.subtitle,
    fontWeight: '400',
  },
  sectionTitle: {
    ...typography.body,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.xs,
  },
  userListContainer: {
    maxHeight: 200,
    marginBottom: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  selectedCount: {
    ...typography.caption,
    fontWeight: '500',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  importantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
  },
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  }
})
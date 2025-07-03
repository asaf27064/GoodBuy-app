import React, { useState, useEffect } from 'react'
import {
  Modal,
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

const { height: screenHeight, width: screenWidth } = Dimensions.get('window')

export default function GetAddressModal({ isVisible, onClose, fetchLocation }) {

  const theme = useTheme();
  const gs = globalStylesFactory(theme);

  const [locationName, setLocationName] = useState('');
  const [cityText, setCityText] = useState('');
  const [streetText, setStreetText] = useState('');
  const [streetNumberText, setStreetNumberText] = useState('');
  const country = 'ישראל'; // Since all the data we're working with is in Israel, letting the user input the country is pointless.

  const onSubmit = () => {
    const address = `${streetText} ${streetNumberText}, ${cityText}, ${country}`;
    fetchLocation(address, locationName);
    setLocationName('');
    setCityText('');
    setStreetText('');
    setStreetNumberText('');
    onClose();
  };

  const handleClose = () => {
    setLocationName('');
    setCityText('');
    setStreetText('');
    setStreetNumberText('');
    onClose();
  };


  if (!isVisible) return null;

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
            הוספת מיקום חדש
          </Text>

          <TextInput
            placeholder="שם (לדוג': בית, עבודה...)"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={locationName}
            onChangeText={setLocationName}
            style={[styles.input, { 
              borderBottomColor: theme.colors.outline,
              color: theme.colors.onSurface
            }]}
          />

          <TextInput
            placeholder="עיר"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={cityText}
            onChangeText={setCityText}
            style={[styles.input, { 
              borderBottomColor: theme.colors.outline,
              color: theme.colors.onSurface
            }]}
          />
          <TextInput
            placeholder="שם רחוב"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={streetText}
            onChangeText={setStreetText}
            style={[styles.input, { 
              borderBottomColor: theme.colors.outline,
              color: theme.colors.onSurface
            }]}
          />

          <TextInput
            placeholder="מספר בית"
            placeholderTextColor={theme.colors.onSurfaceVariant}
            value={streetNumberText}
            onChangeText={setStreetNumberText}
            style={[styles.input, { 
              borderBottomColor: theme.colors.outline,
              color: theme.colors.onSurface
            }]}
          />

          <TouchableHighlight 
            onPress={onSubmit} 
            style={[
              styles.button, 
              { 
                backgroundColor: cityText.trim() ? theme.colors.primary : theme.colors.surfaceVariant,
                opacity: cityText.trim() ? 1 : 0.6
              }
            ]}
            disabled={!cityText.trim()}
            underlayColor={theme.colors.primaryContainer}
          >
            <Text style={{ 
              color: cityText.trim() ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
              fontWeight: '600'
            }}>
              שמור מיקום
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
    padding: 24,
    borderRadius: 16,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  input: {
    borderBottomWidth: 1,
    marginBottom: 20,
    paddingVertical: 8,
    fontSize: 16,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 12,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  userListContainer: {
    maxHeight: 200,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  selectedCount: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  importantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  }
})
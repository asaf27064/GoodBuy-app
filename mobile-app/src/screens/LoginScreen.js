import React, { useState, useCallback } from 'react'
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import { Text, TextInput, HelperText, Button, useTheme } from 'react-native-paper'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../utils/translations'
import { useNavigation, useFocusEffect } from '@react-navigation/native'

export default function LoginScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const t = useT()

  const { login } = useAuth()
  const navigation = useNavigation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useFocusEffect(
    useCallback(() => {
      setUsername('')
      setPassword('')
      setError('')
    }, [])
  )

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (e) {
      const msg = e.response?.data?.message || t('loginScreen.serverError')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('loginScreen.title')}</Text>

          <TextInput
            label={t('shared.username')}
            mode="outlined"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            error={!!error}
            style={[styles.input, { backgroundColor: theme.colors.surface }]}
            outlineStyle={{ borderRadius: theme.roundness }}
          />

          <TextInput
            label={t('shared.password')}
            mode="outlined"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={!!error}
            style={[styles.input, { backgroundColor: theme.colors.surface }]}
            outlineStyle={{ borderRadius: theme.roundness }}
          />

          {error ? <HelperText type="error" visible>{error}</HelperText> : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || !username || !password}
            style={[styles.button, { borderRadius: theme.roundness }]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={theme.colors.primary}
            rippleColor="rgba(255,255,255,0.3)"
          >
            {t('loginScreen.loginButtonText')}
          </Button>

          <Button
            onPress={() => navigation.navigate('Register')}
            uppercase={false}
            style={styles.link}
            labelStyle={[styles.linkLabel, { color: theme.colors.primary }]}
          >
            {t('loginScreen.goToSignUpText')}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function makeStyles(theme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.colors.background
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 20
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.roundness,
      padding: 20,
      elevation: 5
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.primary,
      textAlign: 'center',
      marginBottom: 20
    },
    input: {
      marginBottom: 8
    },
    button: {
      marginTop: 16
    },
    buttonContent: {
      paddingVertical: 8
    },
    buttonLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.onPrimary || '#fff'
    },
    link: {
      marginTop: 8
    },
    linkLabel: {
    }
  })
}

import React, { useState } from 'react'
import {
  SafeAreaView,
  ScrollView,
  View,
  StyleSheet,
  Alert
} from 'react-native'
import {
  Text,
  TextInput,
  HelperText,
  Button,
  useTheme
} from 'react-native-paper'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useT } from '../utils/translations'
import { useNavigation } from '@react-navigation/native'

export default function RegisterScreen() {
  const theme = useTheme()
  const styles = makeStyles(theme)
  const t = useT()

  const { register } = useAuth()
  const navigation = useNavigation()
  const { show: toast } = useToast()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  const isEmailValid = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  const isUsernameValid = u => /^[a-zA-Z0-9_]{3,20}$/.test(u)
  const isPasswordValid = p =>
    p.length >= 8 &&
    /[a-z]/.test(p) &&
    /[A-Z]/.test(p) &&
    /[0-9]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)

  const handleSignUp = async () => {
    const clientErrors = {}
    if (!isEmailValid(email)) clientErrors.email = t('registerScreen.invalidEmailErrorText')
    if (!isUsernameValid(username)) clientErrors.username = t('registerScreen.validUsernameText')
    if (!isPasswordValid(password)) clientErrors.password = t('registerScreen.validPasswordText')
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      return
    }

    setLoading(true)
    try {
      const { message } = await register(email, username, password)
      Alert.alert(t('registerScreen.successTitle'), message, [
        { text: t('shared.confirm'), onPress: () => navigation.goBack() }
      ])
    } catch (e) {
      const data = e.response?.data
      if (data?.errors) {
        const map = {}
        data.errors.forEach(({ param, msg }) => (map[param] = msg))
        setErrors(map)
      } else {
        toast(data?.message || t('registerScreen.serverError'), { variant: 'error' })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('registerScreen.title')}</Text>

          <TextInput
            label={t('shared.email')}
            mode="outlined"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={!!errors.email}
            style={[styles.input, { backgroundColor: theme.colors.surface }]}
            outlineStyle={{ borderRadius: theme.roundness }}
          />
          <HelperText type={errors.email ? 'error' : 'info'}>
            {errors.email || `${t('shared.example')}: ${t('shared.emailExample')}`}
          </HelperText>

          <TextInput
            label={t('shared.username')}
            mode="outlined"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            error={!!errors.username}
            style={[styles.input, { backgroundColor: theme.colors.surface }]}
            outlineStyle={{ borderRadius: theme.roundness }}
          />
          <HelperText type={errors.username ? 'error' : 'info'}>
            {errors.username || t('registerScreen.validUsernameText')}
          </HelperText>

          <TextInput
            label={t('shared.password')}
            mode="outlined"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={!!errors.password}
            style={[styles.input, { backgroundColor: theme.colors.surface }]}
            outlineStyle={{ borderRadius: theme.roundness }}
          />
          <HelperText type={errors.password ? 'error' : 'info'}>
            {errors.password || t('registerScreen.validPasswordText')}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleSignUp}
            loading={loading}
            disabled={loading || !email || !username || !password}
            style={[styles.button, { borderRadius: theme.roundness }]}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
            buttonColor={theme.colors.primary}
            rippleColor="rgba(255,255,255,0.3)"
          >
            {t('registerScreen.registerButtonText')}
          </Button>

          <Button
            onPress={() => navigation.goBack()}
            uppercase={false}
            style={styles.link}
            labelStyle={[styles.linkLabel, { color: theme.colors.primary }]}
          >
            {t('registerScreen.goToLoginText')}
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

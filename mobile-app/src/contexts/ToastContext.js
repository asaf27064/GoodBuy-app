import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Text } from 'react-native'
import { Snackbar, useTheme } from 'react-native-paper'
import * as Haptic from '../utils/haptics'

// Global toast/snackbar. Use instead of Alert.alert for non-blocking
// notifications (success / error / info). Confirmation dialogs (cancel +
// destructive) should still use Alert.alert — Snackbar is for one-way
// messages, not decisions.
//
// Usage:
//   const { show } = useToast()
//   show('הרכישה בוצעה בהצלחה')
//   show('הפעולה נכשלה', { variant: 'error' })

const ToastContext = createContext({ show: () => {} })

export function ToastProvider({ children }) {
  const theme = useTheme()
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const [variant, setVariant] = useState('info')
  const timer = useRef(null)

  const dismiss = useCallback(() => {
    setVisible(false)
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  const show = useCallback((msg, opts = {}) => {
    if (!msg) return
    const v = opts.variant || 'info'
    setMessage(String(msg))
    setVariant(v)
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), opts.duration || 3200)
    // Subtle haptic cue tied to the visual variant. Suppressed when the
    // caller opts out (e.g. for very chatty notification streams).
    if (opts.haptic !== false) {
      if (v === 'error') Haptic.error()
      else if (v === 'success') Haptic.success()
    }
  }, [])

  const bg =
    variant === 'error'   ? theme.colors.errorContainer    || theme.colors.error :
    variant === 'success' ? theme.colors.primaryContainer  || theme.colors.primary :
                            theme.colors.inverseSurface
  const fg =
    variant === 'error'   ? theme.colors.onErrorContainer   || theme.colors.onError :
    variant === 'success' ? theme.colors.onPrimaryContainer || theme.colors.onPrimary :
                            theme.colors.inverseOnSurface

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <Snackbar
        visible={visible}
        onDismiss={dismiss}
        duration={3200}
        style={{ backgroundColor: bg }}
        wrapperStyle={{ zIndex: 10000 }}
      >
        <Text style={{ color: fg }}>{message}</Text>
      </Snackbar>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

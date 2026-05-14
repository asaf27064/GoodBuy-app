import React, {
  createContext, useState, useEffect, useCallback, useRef
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Snackbar, useTheme } from 'react-native-paper';

export const PriceSyncContext = createContext();

export function PriceSyncProvider({ children }) {
  const [lastSuccess, setLastSuccess] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const [snack, setSnack] = useState({ visible: false, msg: '' });
  const theme = useTheme();
  const showSnack = msg =>
    setSnack({ visible: true, msg });

  const pollTimerRef = useRef(null);
  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem('priceLastSuccess');
        if (cached) setLastSuccess(+new Date(cached));

        const { data } = await axios.get('/api/system/price-status');
        if (data.lastRunEnd && data.lastRunOk) {
          const ts = +new Date(data.lastRunEnd);
          setLastSuccess(ts);
          await AsyncStorage.setItem('priceLastSuccess', data.lastRunEnd);
        }
      } catch (e) {
        console.warn('status fetch failed', e.message);
      }
    })();
  }, []);

  const triggerSync = useCallback(async () => {
    if (syncing) return false;

    try {
      const { data: st } = await axios.get('/api/system/price-status');
      const last = st.lastRunEnd ? +new Date(st.lastRunEnd) : 0;
      const stale = !st.lastRunOk || (Date.now() - last > 24 * 60 * 60 * 1e3);

      if (!stale) { showSnack('Prices already up-to-date'); return false; }
      if (st.running) { showSnack('Refresh already running'); return false; }
    } catch { }

    setSyncing(true);
    await AsyncStorage.removeItem('priceLastSuccess');
    try {
      await axios.post('/api/system/price-refresh');
      showSnack('Price refresh started');
    } catch (e) {
      showSnack('Failed to start refresh');
      setSyncing(false);
      return false;
    }

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get('/api/system/price-status');

        if (data.lastRunEnd && data.lastRunOk) {
          const ts = +new Date(data.lastRunEnd);
          setLastSuccess(ts);
          await AsyncStorage.setItem('priceLastSuccess', data.lastRunEnd);
        }

        if (!data.running) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setSyncing(false);
          showSnack('Prices updated ✓');
        }
      } catch { }
    }, 30_000);

    return true;
  }, [syncing]);

  return (
    <PriceSyncContext.Provider value={{ lastSuccess, syncing, triggerSync }}>
      {children}

      {/* Keep the Snackbar here since it should be global */}
      <Snackbar
        visible={snack.visible}
        onDismiss={() => setSnack({ ...snack, visible: false })}
        duration={3000}
        style={{ backgroundColor: theme.colors.inverseSurface }}
      >
        {snack.msg}
      </Snackbar>
    </PriceSyncContext.Provider>
  );
}
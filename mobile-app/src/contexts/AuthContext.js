import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { API_BASE } from '../config';

axios.defaults.baseURL = API_BASE;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  // Apply or remove Authorization header for axios
  const applyAuth = useCallback(t => {
    if (t) axios.defaults.headers.common.Authorization = `Bearer ${t}`;
    else delete axios.defaults.headers.common.Authorization;
  }, []);

  // Logout: clear both tokens & user
  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('refreshToken');
    setToken(null);
    setUser(null);
    applyAuth(null);
  }, [applyAuth]);

  // On app start: load token, validate with /auth/me, store user
  useEffect(() => {
    (async () => {
      const t = await SecureStore.getItemAsync('token');
      if (t) {
        applyAuth(t);
        try {
          const { data } = await axios.get('/auth/me');
          setUser(data.user);
          setToken(t);
        } catch {
          await logout();
        }
      }
      setLoading(false);
    })();
  }, [applyAuth, logout]);

  // On 401: try refresh, else logout
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      async error => {
        const orig = error.config;
        if (error.response?.status === 401 && !orig._retry) {
          orig._retry = true;
          const rt = await SecureStore.getItemAsync('refreshToken');
          if (rt) {
            try {
              const { data } = await axios.post('/auth/refresh', { refreshToken: rt });
              await SecureStore.setItemAsync('token', data.accessToken);
              // Persist rotated refresh token when the server returns one
              if (data.refreshToken) {
                await SecureStore.setItemAsync('refreshToken', data.refreshToken);
              }
              applyAuth(data.accessToken);
              // Propagate the new token to React state so downstream effects
              // (e.g. ListSocketContext useEffect([token])) reconnect with the
              // fresh token instead of silently failing with the expired one.
              setToken(data.accessToken);
              orig.headers.Authorization = `Bearer ${data.accessToken}`;
              return axios(orig);
            } catch {
              await logout();
            }
          } else {
            await logout();
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, [applyAuth, logout]);

  // Login: store tokens & fetch user
  const login = async (username, password) => {
    const { data } = await axios.post('/auth/login', { username, password });
    await SecureStore.setItemAsync('token', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    applyAuth(data.accessToken);
    setToken(data.accessToken);
    const { data: me } = await axios.get('/auth/me');
    setUser(me.user);
  };

  // Register: return server message
  const register = async (email, username, password) => {
    const { data } = await axios.post('/auth/register', {
      email,
      username,
      password
    });
    return data;
  };

  return (
    <AuthContext.Provider
      value={{ token, user, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

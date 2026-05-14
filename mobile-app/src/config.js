// API_BASE — set this to the URL of your running backend.
// Common local dev values:
//   Android emulator     -> 'http://10.0.2.2:3000'
//   iOS simulator        -> 'http://localhost:3000'
//   Physical device on LAN -> 'http://<YOUR_LAN_IP>:3000'
// In production this should be your HTTPS backend URL.
export const API_BASE =
  (typeof process !== 'undefined' && process.env && process.env.EXPO_PUBLIC_API_BASE) ||
  'http://10.0.2.2:3000'

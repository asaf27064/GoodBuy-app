import { API_BASE } from '../config';
import * as Location from 'expo-location';

import axios from 'axios';
axios.defaults.baseURL = API_BASE;

export default async function getCurrentLocation() {

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setErrorMsg('Permission to access location was denied');
      return;
    }

    let loc = await Location.getCurrentPositionAsync({});
    const latitude = loc.coords.latitude;
    const longitude = loc.coords.longitude;

    return {latitude, longitude};
}
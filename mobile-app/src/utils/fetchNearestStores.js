import { API_BASE } from '../config';


import axios from 'axios';
axios.defaults.baseURL = API_BASE;

export default async function fetchNearestStores(lat, long) {

    try {
        const response = await axios.get('/api/Stores/store_search', {params: {latitude: lat, longitude: long}});

        return response.data;
      } catch (err) {
        console.error('Error locating stores:', err);
      }
}
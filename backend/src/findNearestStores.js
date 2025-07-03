

const allStores = require('./GoodBuy.stores.json'); // currently just for testing, later need to access the DB on server.
const { performance } = require('perf_hooks');

// Based on Haversine formula: https://en.wikipedia.org/wiki/Haversine_formula.

const DEG_TO_RADIAN_MOD = Math.PI / 180; // x in radians = PI/180 * x in degrees.
const DEG_TO_KM_MOD = 111.32;
const SPHERE_RAD = 6371; // Earth's radius in KM.
const NUM_OF_STORES = 5;


function findNearestStores(requestedLocation){

  try{

    // Passed two Points defined by decimal Longitude and latitude values, returns distance in KM.
    const calculateDistanceInKM = (point1, point2) => {

        let deltaLat = (point2.latitude - point1.latitude) * DEG_TO_RADIAN_MOD;
        let deltaLon = (point2.longitude - point1.longitude) * DEG_TO_RADIAN_MOD;
        let lat1Rad = point1.latitude * DEG_TO_RADIAN_MOD;
        let lat2Rad = point2.latitude * DEG_TO_RADIAN_MOD;

        let havTheta = haversineFunc(deltaLat) + (Math.cos(lat1Rad)*Math.cos(lat2Rad)*haversineFunc(deltaLon));
        
        return (2*SPHERE_RAD*Math.asin(Math.sqrt(havTheta))); // Convert to distance in KM on the surface of the sphere.

    };

    // Assumes angle is in radians.

    const haversineFunc = (angle) => {
        return (1-Math.cos(angle))/2
    };




    const findStoresDistance = (store) => {
        let dist = calculateDistanceInKM(userLocation, store.location);
        store.distance = dist;
        return ((dist <= initialRad) ? true : false); // Not sure if that does anything anymore, but if it works it works.
    };

    const MAX_RAD = 256; // If no stores are within 256km of you... consider moving.
    let initialRad = 2;
    let storesAndLocations = [];
    let results = [];
    
    const baseLat = parseFloat(requestedLocation.latitude);
    const baseLon = parseFloat(requestedLocation.longitude);
    const userLocation = {latitude: baseLat, longitude: baseLon};

    console.log(userLocation);

    while(initialRad <= MAX_RAD) {

        // Only calculate distance to stores within the bounded box.

        storesAndLocations = allStores.filter((store) => {
            
            const storeLat = store.location.coordinates[1];
            const storeLon = store.location.coordinates[0];


            const boxBounderLat = initialRad / DEG_TO_KM_MOD;
            const boxBounderLon = initialRad / (DEG_TO_KM_MOD * Math.cos(baseLat * DEG_TO_RADIAN_MOD));

            return (
              (storeLat >= baseLat - boxBounderLat) &&
              (storeLat <= baseLat + boxBounderLat) &&
              (storeLon >= baseLon - boxBounderLon) &&
              (storeLon <= baseLon + boxBounderLon)
            );
          })
          .map((store) => ({
            store: store,
            location: {latitude: store.location.coordinates[1], longitude: store.location.coordinates[0]}
          }));

        // Consider removing the content of "results" from "storesAndLocations", to prevent redundant calculations in case of more iterations.
        results = storesAndLocations.filter(findStoresDistance);
        

        if (results.length >= NUM_OF_STORES) {
            break;
        }
        initialRad *= 2;
    };

    // IMPORTANT NOTE: IF THIS CODE IS CHANGED SO THE RESULTS ARE NOT ORDERED BY DISTANCE,
    // THE ENTIRE PRICE COMPARISON PIPELINE CODE MUST BE CHANGED ACCORDINGLY.

    results = results.sort((a, b) => a.distance - b.distance)
    .slice(0, Math.min(NUM_OF_STORES, results.length)); // Order by proximity from user's location and take the closest 5.




    console.log(JSON.stringify(results[0]));
    console.log(initialRad);

    return results;
}

catch (error) {
  console.log("error in findNearestStores");
  throw error;
}

};

module.exports = { findNearestStores };
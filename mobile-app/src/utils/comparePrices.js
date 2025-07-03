

const countNonNullsInArray = (arr) => {

    return arr.filter(element => element != null).length;
};

const isEmpty = (obj) => {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false; // Found a key, object is not empty
      }
    }
    return true; // No keys found, object is empty
s};

const findMissingItems = (arr) => {

    return arr.filter(productPrice => productPrice.unitPrice == null);
};

const sumArray = (arr) => {

    return arr.reduce((partialSum, a) => partialSum + a, 0);
};

// purchaseOption is an object in this format: { storeId, distance, productPrices: [{productCode, amount, unitPrice}] }
// mode is a string, currently either "strict" or "lax".

// IMPORTANT NOTE: PURCHASE OPTIONS ARE ORDERED BY DISTANCE FROM POINT OF ORIGIN IN THE SERVER.
// IF THIS BEHAVIOUR IS CHANGED, THE CODE IN THE ENTIRE PRICE COMPARISON PIPELINE MUST BE CHANGED ACCORDINGLY.

function comparePrices(purchaseOptions, mode){

    // Define algrithm parameters
    const numItems = purchaseOptions[0].productPrices.length;
    
    const [COMPLETENESS_THRESHOLD, PENALTY_MULT_1_STORE, PENALTY_MULT_2_STORES] = (() => {


        switch(mode){
            // TODO: maybe strings should have the 50% completness threshold? It might lose cheap options due to not having 70% of the list.

            case 'favor_price':
                return [Math.ceil(numItems*0.5), 1.25, 1.5];
            case 'favor_completeness':
                return [Math.ceil(numItems*0.7), 1.5, 2.0];
            default:
                [Math.ceil(numItems*0.5), 1, 1];
        }
      })();
      

    const avgPrice = (() => {

        let nonNullItemsCount = 0;
        let sumPrices = 0;

        for(const entry of purchaseOptions) {

            nonNullItemsCount += (numItems - findMissingItems(entry.productPrices).length);
            sumPrices += sumArray(entry.productPrices.map(item => item.unitPrice));
        }
        if (nonNullItemsCount == 0) {
            return 35.00 // roughly the average of a single item.
        }
        return sumPrices / nonNullItemsCount;
      })();


    // Helper functions

    const findBestValueStore = (storeOptions, penaltyModifier) => {

        let bestStore = {};
        let bestPriceValue = Number.MAX_VALUE;

        for(const option of storeOptions) {

            const priceList = option.productPrices.map(item => item.unitPrice);
            const missingItems = findMissingItems(option.productPrices);

            const priceValue = (sumArray(priceList) 
            + (avgPrice * penaltyModifier * missingItems.length));
            
            if ((numItems - missingItems.length) >= COMPLETENESS_THRESHOLD && priceValue < bestPriceValue) {
                bestStore = option;
                bestStore.missingItems = missingItems;
                bestPriceValue = priceValue;
            }
        }

        return bestStore;
    };

    // Reuse "findBestValueStore" code by combining each pair of stores into a "faux" single store.
    // Instead of using another algorithm, we basically modify the data to create an input for the previous one.
    let x = 1;
    const findBestValueTwoStores = () => {

        const numStores = purchaseOptions.length;
        const storePairs = [];

        for(let i = 0; i < numStores; i++) {
          for(let j = i+1; j < numStores; j++) {

            const store1 = purchaseOptions[i];
            const store2 = purchaseOptions[j];
            const combinedProductPrices = JSON.parse(JSON.stringify((store1.productPrices)));
            const buyFromStore1 = new Set();
            const buyFromStore2 = new Set();

            for (let k = 0; k < numItems; k++) {
                const priceInStore1 = store1.productPrices[k].unitPrice;
                const priceInStore2 = store2.productPrices[k].unitPrice;

                if (priceInStore1 == null && priceInStore2 == null) {
                    continue;
                }

                if (priceInStore2 == null || (priceInStore1 != null && priceInStore1 <= priceInStore2)) {
                    combinedProductPrices[k].unitPrice = priceInStore1;
                    buyFromStore1.add(combinedProductPrices[k].productCode);
                    continue;
                }

                if (priceInStore1 == null || (priceInStore2 != null && priceInStore2 < priceInStore1)) {
                    combinedProductPrices[k].unitPrice = priceInStore2;
                    buyFromStore2.add(combinedProductPrices[k].productCode);
                    continue;
                }
                
            }

            // Skip in case where the combinations is equivalent to a single store option, which would be wasteful to calculate.
            if (buyFromStore1.size === 0 || buyFromStore2.size === 0) {
                continue;
            }

            storePairs.push({storeIds: [store1.storeId, store2.storeId], storeItemMap: {buyFromStore1: buyFromStore1, buyFromStore2: buyFromStore2}, productPrices: combinedProductPrices});

          }
        }

        return findBestValueStore(storePairs, PENALTY_MULT_2_STORES);
    };


    const findClosestStore = () => {

        // REPLACE THE BLOCK CODE WITH THE COMMENTED CODE IF PURCHASEOPTIONS IS NO LONGER ORDERED BY DISTANCE.

        /*let closestStore = {};
        let minDistance = Number.MAX_VALUE;
        
        for(const option of purchaseOptions) {

            if (option.distance < minDistance) {
                closestStore = option;
                const missingItems = findMissingItems(option.productPrices);
                closestStore.missingItems = missingItems;
                minDistance = option.distance;
            }
        }*/

        let closestStore = purchaseOptions[0];
        const missingItems = findMissingItems(purchaseOptions[0].productPrices);
        closestStore.missingItems = missingItems;

        return ((numItems - missingItems) > COMPLETENESS_THRESHOLD) ? closestStore : {};
    };


    
    const bestOneStore = findBestValueStore(purchaseOptions, PENALTY_MULT_1_STORE)
    const bestTwoStores = findBestValueTwoStores();
    const closestStore = findClosestStore();

    // Non-empty options will be pushed into results.
    const results = [];

    // Normalize the structure, so the different object types can be processed and rendered together later.
    // Reason field is added to determine the displayed option's title.

    if(!isEmpty(bestOneStore)) {
        bestOneStore.storeIds = [bestOneStore.storeId];
        bestOneStore.optionType = 'single';
        bestOneStore.reason = 'best';
        results.push(bestOneStore);
    }

    // If bestOneStore and closestStore are the same object in memory, skip.
    // Will prevent redundant options from being displayed.
    if(!isEmpty(closestStore) && !(bestOneStore === closestStore)) {
        closestStore.storeIds = [closestStore.storeId];
        closestStore.optionType = 'single';
        closestStore.reason = 'nearest';
        results.push(closestStore);
    }

    if(!isEmpty(bestTwoStores)) {
        bestTwoStores.optionType = 'multi';
        bestTwoStores.reason = 'best';
        results.push(bestTwoStores);
    }


    return results;
};

export default comparePrices;

function formatDate(timestamp){

    if (Object.prototype.toString.call(timestamp) === '[object Date]'){

        // Since getMonth return a "month index" from 0-11, we add 1. "getDate" is for the day of the month.
        return timestamp.getHours() + ':' + timestamp.getMinutes() + ' ,' + timestamp.getDate() + '/' + (timestamp.getMonth()+1) + '/' + timestamp.getFullYear();
    }
    return ""
};

export default formatDate;
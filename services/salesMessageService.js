const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;

// =====================================
// GET FULL MESSAGE DETAILS (includes media)
// =====================================
async function getMessageById(messageId) {

    try {

        const response = await axios.get(
            `https://api.salesmessage.com/pub/v2.2/messages/${messageId}`,
            {
                headers: {
                    Authorization: `Bearer ${SALESMESSAGE_API_TOKEN}`
                }
            }
        );

        console.log("====== SALESMESSAGE MESSAGE DETAIL ======");
        console.log(JSON.stringify(response.data, null, 2));

        return response.data;

    } catch (error) {

        console.log("====== SALESMESSAGE FETCH ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

        return null;

    }

}

module.exports = {
    getMessageById
};
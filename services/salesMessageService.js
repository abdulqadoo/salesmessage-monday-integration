const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;

// =====================================
// GET MOST RECENT ATTACHMENT (e.g. MMS image)
// =====================================
async function getRecentAttachment() {

    try {

        const response = await axios.get(
            `https://api.salesmessage.com/pub/v2.3/attachments/recently`,
            {
                headers: {
                    Authorization: `Bearer ${SALESMESSAGE_API_TOKEN}`
                }
            }
        );

        console.log("====== SALESMESSAGE RECENT ATTACHMENTS ======");
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
    getRecentAttachment
};
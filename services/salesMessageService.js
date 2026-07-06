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

        const attachments = response.data;

        if (!attachments || attachments.length === 0) {
            console.log("No attachments found.");
            return null;
        }

        // List comes back most-recent-first
        const latest = attachments[0];

        return {
            id: latest.id,
            url: latest.source,
            name: latest.name,
            contentType: latest.content_type
        };

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
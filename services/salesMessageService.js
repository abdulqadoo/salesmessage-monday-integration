const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;

async function getRecentAttachment() {

    try {

        // Short delay to let SalesMessage finish processing the upload
        await new Promise(resolve => setTimeout(resolve, 3000));

        const response = await axios.get(
            "https://api.salesmessage.com/pub/v2.3/attachments/recently",
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

        // Filter to only fully-processed, ready image attachments
        const readyImages = attachments.filter(a =>
            a.type === "image" &&
            a.processing === 0 &&
            a.is_allowed_for_media_url === true &&
            a.source
        );

        if (readyImages.length === 0) {
            console.log("No ready image attachments found.");
            return null;
        }

        // Most recent ready image - no reliable way to match by message/conversation
        const latest = readyImages[0];

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
const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getRecentAttachment() {

    // Give SalesMessage time to finish uploading the file
    await sleep(3000);

    try {

        const response = await axios.get(
            "https://api.salesmessage.com/pub/v2.3/attachments/recently",
            {
                headers: {
                    Authorization: `Bearer ${SALESMESSAGE_API_TOKEN}`
                }
            }
        );

        const attachments = response.data || [];

        if (!attachments.length) {
            return null;
        }

        // Only completed image attachments
        const image = attachments.find(a =>
            a.type === "image" &&
            a.processing === 0 &&
            a.source &&
            a.is_allowed_for_media_url === true
        );

        if (!image) {
            return null;
        }

        return {
            id: image.id,
            url: image.source,
            name: image.name,
            contentType: image.content_type
        };

    } catch (err) {

        console.log("Attachment Error:");
        console.log(err.response?.data || err.message);

        return null;
    }
}

module.exports = {
    getRecentAttachment
};
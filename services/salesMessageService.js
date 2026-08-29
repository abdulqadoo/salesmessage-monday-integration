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

// ===============================
// PHONE NORMALIZATION
// ===============================
function normalizePhone(phone) {
    if (!phone) return null;
    let digits = phone.replace(/[^\d]/g, "");
    if (digits.length === 10) digits = "1" + digits; // assume US if 10 digits
    return "+" + digits;
}

// ===============================
// SEARCH CONTACT BY PHONE
// ===============================
async function searchContactByPhone(rawPhone) {

    const phone = normalizePhone(rawPhone);

    if (!phone) {
        console.log("No phone provided to searchContactByPhone.");
        return null;
    }

    try {

        const response = await axios.get(
            "https://api.salesmessage.com/pub/v2.3/contacts",
            {
                headers: {
                    Authorization: `Bearer ${SALESMESSAGE_API_TOKEN}`
                },
                params: { search: phone }
            }
        );

        console.log("====== SALESMESSAGE CONTACT SEARCH ======");
        console.log(JSON.stringify(response.data, null, 2));

        const contacts = response.data?.data;

        if (!contacts || contacts.length === 0) {
            console.log(`No SalesMessage contact found for ${phone}`);
            return null;
        }

        const contact = contacts[0];

        return {
            id: contact.id,
            phone: contact.number || phone
        };

    } catch (error) {

        console.log("====== SALESMESSAGE CONTACT SEARCH ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

        return null;

    }

}

module.exports = {
    getRecentAttachment,
    normalizePhone,
    searchContactByPhone
};
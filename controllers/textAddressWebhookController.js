const axios = require("axios");
const { updateColumnValues } = require("../services/mondayService");

const BOARD_ID = process.env.BOARD_ID;
const TEXT_ADDRESS_COLUMN_ID = process.env.TEXT_ADDRESS_COLUMN_ID || "text_mm5wmtxq";
const LOCATION_COLUMN_ID = process.env.LOCATION_COLUMN_ID || "location_mm2w35dr";


async function geocodeAddress(address) {

    try {

        const response = await axios.get("https://nominatim.openstreetmap.org/search", {
            params: {
                q: address,
                format: "json",
                limit: 1
            },
            headers: {
                "User-Agent": "salesmessage-monday-integration/1.0"
            }
        });

        const result = response.data?.[0];

        if (!result) {
            return null;
        }

        return {
            lat: result.lat,
            lng: result.lon
        };

    } catch (error) {

        console.log("====== GEOCODE ERROR ======");
        console.log(error.response?.data || error.message);
        return null;

    }

}


async function processTextAddressWebhook(req) {

    try {

        console.log("========== TEXT ADDRESS WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const event = req.body.event;

        if (!event) {
            return;
        }

       if (event.columnId !== TEXT_ADDRESS_COLUMN_ID) {
    console.log("Changed column is not the Text Address column, skipping. Changed:", event.columnId);
    return;
}

const itemId = event.pulseId;

if (!itemId) {
    console.log("No pulseId found, skipping.");
    return;
}

const rawAddress = event.value?.value || event.value?.text || "";
        console.log("Raw text address:", rawAddress);

        if (!rawAddress || !rawAddress.trim()) {
            console.log("No address text found on new item, skipping.");
            return;
        }

        const coords = await geocodeAddress(rawAddress.trim());

        if (!coords) {
            console.log("Could not geocode address, skipping location update.");
            return;
        }

        console.log("Geocoded to:", coords);

        await updateColumnValues(BOARD_ID, itemId, {
            [LOCATION_COLUMN_ID]: {
                lat: coords.lat,
                lng: coords.lng,
                address: rawAddress.trim()
            }
        });

        console.log("✅ Location column updated from text address:", rawAddress.trim());

    } catch (err) {

        console.error("Text Address Webhook Error:", err);

    }

}


exports.textAddressWebhook = async (req, res) => {

    if (req.body.challenge) {
        return res.status(200).json({ challenge: req.body.challenge });
    }

    res.status(200).json({ success: true });

    await processTextAddressWebhook(req);

};
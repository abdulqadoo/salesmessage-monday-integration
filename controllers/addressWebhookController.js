const axios = require("axios");
const { updateColumnValues } = require("../services/mondayService");

const ADDRESS_BOARD_ID = process.env.BOARD_ID;
const ADDRESS_COLUMN_ID = process.env.ADDRESS_COLUMN_ID;
const LOCATION_LINK_COLUMN_ID = process.env.LOCATION_LINK_COLUMN_ID;
const TEXT_ADDRESS_COLUMN_ID = process.env.TEXT_ADDRESS_COLUMN_ID || "text_mm5wmtxq";
const LOCATION_COLUMN_ID = process.env.LOCATION_COLUMN_ID || "location_mm2w35dr";

console.log("DEBUG ADDRESS_COLUMN_ID env value:", JSON.stringify(ADDRESS_COLUMN_ID));


function buildGoogleEarthUrl(address, lat, lng) {

    const formattedAddress = address.trim().replace(/\s+/g, "+");

    return `https://earth.google.com/web/search/${formattedAddress}/@${lat},${lng},1000a,1000d,35y,0h,0t,0r`;

}


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


async function processAddressWebhook(req) {

    try {

        console.log("========== ADDRESS WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const event = req.body.event;

        if (!event) {
            return;
        }

        const itemId = event.pulseId;

        // =====================================
        // CASE 1: Location column changed -> build Google Earth link
        // =====================================
        if (event.columnId === ADDRESS_COLUMN_ID) {

            const newAddress =
                event.value?.address ||
                event.value?.value?.address ||
                event.value?.text ||
                "";

            const lat = event.value?.lat;
            const lng = event.value?.lng;

            console.log("New address value:", newAddress, "| lat:", lat, "| lng:", lng);

            if (!newAddress || !newAddress.trim()) {

                console.log("Address is empty - clearing Location Link column.");

                await updateColumnValues(ADDRESS_BOARD_ID, itemId, {
                    [LOCATION_LINK_COLUMN_ID]: { url: "", text: "" }
                });

                return;

            }

            if (!lat || !lng) {

                console.log("No coordinates found for this address, skipping link generation.");
                return;

            }

            const earthUrl = buildGoogleEarthUrl(newAddress, lat, lng);

            console.log("DEBUG generated earthUrl:", earthUrl);

            await updateColumnValues(ADDRESS_BOARD_ID, itemId, {
                [LOCATION_LINK_COLUMN_ID]: {
                    url: earthUrl,
                    text: "View on Google Earth"
                }
            });

            console.log("✅ Location Link updated:", earthUrl);

            return;

        }

        // =====================================
        // CASE 2: Text Address column changed -> geocode into Location column
        // =====================================
        if (event.columnId === TEXT_ADDRESS_COLUMN_ID) {

            const rawAddress = event.value?.value || event.value?.text || "";

            console.log("Raw text address:", rawAddress);

            if (!rawAddress || !rawAddress.trim()) {
                console.log("Text address is empty, skipping geocoding.");
                return;
            }

            const coords = await geocodeAddress(rawAddress.trim());

            if (!coords) {
                console.log("Could not geocode address, skipping location update.");
                return;
            }

            console.log("Geocoded to:", coords);

            await updateColumnValues(ADDRESS_BOARD_ID, itemId, {
                [LOCATION_COLUMN_ID]: {
                    lat: coords.lat,
                    lng: coords.lng,
                    address: rawAddress.trim()
                }
            });

            console.log("✅ Location column updated from text address:", rawAddress.trim());

            return;

        }

        console.log("Changed column is not Address or Text Address, skipping. Changed:", event.columnId);

    } catch (err) {

        console.error("Address Webhook Error:", err);

    }

}


exports.addressWebhook = async (req, res) => {

    if (req.body.challenge) {
        return res.status(200).json({ challenge: req.body.challenge });
    }

    res.status(200).json({ success: true });

    await processAddressWebhook(req);

};
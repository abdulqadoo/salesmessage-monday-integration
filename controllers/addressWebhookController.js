const { updateColumnValues } = require("../services/mondayService");

console.log("DEBUG ADDRESS_COLUMN_ID env value:", JSON.stringify(ADDRESS_COLUMN_ID));
const ADDRESS_BOARD_ID = process.env.BOARD_ID;
const ADDRESS_COLUMN_ID = process.env.ADDRESS_COLUMN_ID;
const LOCATION_LINK_COLUMN_ID = process.env.LOCATION_LINK_COLUMN_ID;


function buildGoogleEarthUrl(lat, lng) {
    return `https://earth.google.com/web/@${lat},${lng},1000a,1000d,35y,0h,0t,0r`;
}


async function processAddressWebhook(req) {

    try {

        console.log("========== ADDRESS WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const event = req.body.event;

        if (!event) {
            return;
        }

        if (event.columnId !== ADDRESS_COLUMN_ID) {
            console.log("Changed column is not the Address column, skipping. Changed:", event.columnId);
            return;
        }

        const itemId = event.pulseId;

        const newAddress =
         event.value?.address ||
         event.value?.value?.address ||
         event.value?.text ||
         "";

        const lat = event.value?.lat;
        const lng = event.value?.lng;

        console.log("New address value:", newAddress);

        if (!newAddress || !newAddress.trim()) {

            console.log("Address is empty - clearing Location Link column.");

            await updateColumnValues(ADDRESS_BOARD_ID, itemId, {
                [LOCATION_LINK_COLUMN_ID]: ""
            });

            return;

        }

        if (!lat || !lng) {
    console.log("No coordinates found for this address, skipping link generation.");
    return;
}

const earthUrl = buildGoogleEarthUrl(lat, lng);

        await updateColumnValues(ADDRESS_BOARD_ID, itemId, {
            [LOCATION_LINK_COLUMN_ID]: earthUrl
        });

        console.log("✅ Location Link updated:", earthUrl);

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
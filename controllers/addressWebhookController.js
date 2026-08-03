const { updateColumnValues } = require("../services/mondayService");

const ADDRESS_BOARD_ID = process.env.BOARD_ID;
const ADDRESS_COLUMN_ID = process.env.ADDRESS_COLUMN_ID;
const LOCATION_LINK_COLUMN_ID = process.env.LOCATION_LINK_COLUMN_ID;


function buildGoogleEarthUrl(address) {

    const encoded = encodeURIComponent(address.trim());

    return `https://earth.google.com/web/search/${encoded}`;

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

        console.log("New address value:", newAddress);

        if (!newAddress || !newAddress.trim()) {

            console.log("Address is empty - clearing Location Link column.");

            await updateColumnValues(ADDRESS_BOARD_ID, itemId, {
                [LOCATION_LINK_COLUMN_ID]: ""
            });

            return;

        }

        const earthUrl = buildGoogleEarthUrl(newAddress);

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
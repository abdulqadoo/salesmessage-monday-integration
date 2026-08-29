// controllers/salesMessageLinkController.js
const { getItem, updateColumnValues } = require("../services/mondayService");
const { normalizePhone } = require("../services/salesMessageService");

const PHONE_COLUMN_ID = "text_mm2wf3qg";
const LINK_COLUMN_ID = "link_mm6mvvd2";
const BOARD_ID = "18409956420";

async function handleSalesMessageLinkWebhook(req, res) {
    // Monday's one-time webhook verification handshake — can arrive as
    // POST body { challenge } or GET query ?challenge=
    const challenge = req.body?.challenge || req.query?.challenge;

    if (challenge) {
        console.log(">>> WEBHOOK CHALLENGE RECEIVED:", challenge);
        return res.json({ challenge });
    }

    console.log(">>> SALESMESSAGE LINK WEBHOOK PAYLOAD:");
    console.log(JSON.stringify(req.body, null, 2));

    // Respond immediately so Monday doesn't retry/timeout on a slow SalesMessage call
    res.status(200).send("ok");

    try {
        const itemId =
            req.body?.event?.pulseId ||
            req.body?.payload?.inputFields?.itemId ||
            req.body?.itemId;

        if (!itemId) {
            console.log("No itemId found in webhook payload — check payload shape above.");
            return;
        }

        const item = await getItem(itemId);
        const phoneColumn = item?.column_values?.find(c => c.id === PHONE_COLUMN_ID);
        const phone = phoneColumn?.text;

        if (!phone) {
            console.log(`No phone value on item ${itemId}`);
            return;
        }

        const normalizedPhone = normalizePhone(phone);

        if (!normalizedPhone) {
            console.log(`Could not normalize phone for item ${itemId}: ${phone}`);
            return;
        }

        const chatUrl = `https://app.salesmessage.com/conversations?phone=${encodeURIComponent(normalizedPhone)}`;

        await updateColumnValues(BOARD_ID, itemId, {
            [LINK_COLUMN_ID]: { url: chatUrl, text: "Open Chat" }
        });

        console.log(`Updated item ${itemId} with SalesMessage link: ${chatUrl}`);

    } catch (error) {
        console.log("====== SALESMESSAGE LINK WEBHOOK ERROR ======");
        console.log(error.message);
    }
}

module.exports = { handleSalesMessageLinkWebhook };
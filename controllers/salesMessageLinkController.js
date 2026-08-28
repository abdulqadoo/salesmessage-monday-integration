// controllers/salesMessageLinkController.js
const { getItem, updateColumnValues } = require("../services/mondayService");
const { searchContactByPhone } = require("../services/salesMessageService");

const PHONE_COLUMN_ID = "text_mm2wf3qg";
const LINK_COLUMN_ID = "link_mm6mvvd2";

async function handleSalesMessageLinkWebhook(req, res) {
    // Monday's one-time webhook verification handshake
    if (req.body.challenge) {
        return res.json({ challenge: req.body.challenge });
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

console.log(">>> FULL ITEM RESPONSE:");
console.log(JSON.stringify(item, null, 2));

const phoneColumn = item?.column_values?.find(c => c.id === PHONE_COLUMN_ID);
const phone = phoneColumn?.text;

console.log(`>>> Phone column found: ${JSON.stringify(phoneColumn)}`);
console.log(`>>> Extracted phone: ${phone}`);

if (!phone) {
    console.log(`No phone value on item ${itemId}`);
    return;
}

        const contact = await searchContactByPhone(phone);

        if (!contact) {
            console.log(`No SalesMessage contact for ${phone} — leaving link column empty`);
            return;
        }

        await updateColumnValues(itemId, {
            [LINK_COLUMN_ID]: { url: contact.chatUrl, text: "Open Chat" }
        });

        console.log(`Updated item ${itemId} with SalesMessage link: ${contact.chatUrl}`);

    } catch (error) {
        console.log("====== SALESMESSAGE LINK WEBHOOK ERROR ======");
        console.log(error.message);
    }
}

module.exports = { handleSalesMessageLinkWebhook };
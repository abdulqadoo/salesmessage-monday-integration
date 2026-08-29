// controllers/salesMessageLinkController.js
const { getItem, updateColumnValues } = require("../services/mondayService");
const { normalizePhone, searchContactByPhone, getConversationForContact } = require("../services/salesMessageService");

const PHONE_COLUMN_ID = "text_mm2wf3qg";
const LINK_COLUMN_ID = "link_mm6mvvd2";
const BOARD_ID = "18409956420";

async function handleSalesMessageLinkWebhook(req, res) {

    const challenge = req.body?.challenge || req.query?.challenge;

    if (challenge) {
        console.log(">>> WEBHOOK CHALLENGE RECEIVED:", challenge);
        return res.json({ challenge });
    }

    console.log(">>> SALESMESSAGE LINK WEBHOOK PAYLOAD:");
    console.log(JSON.stringify(req.body, null, 2));

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

        const contact = await searchContactByPhone(normalizedPhone);

        let chatUrl;

        if (contact?.id) {

            const conversationId = await getConversationForContact(contact.id);

            if (conversationId) {

                chatUrl = `https://app.salesmessage.com/conversations/${conversationId}`;
                console.log(`Found real conversation ID ${conversationId} for contact ${contact.id}`);

            } else {

                console.log(`No conversation found for contact ${contact.id} - falling back to phone-query link.`);
                chatUrl = `https://app.salesmessage.com/conversations?phone=${encodeURIComponent(normalizedPhone)}`;

            }

        } else {

            console.log(`No SalesMessage contact found for ${normalizedPhone} - falling back to phone-query link.`);
            chatUrl = `https://app.salesmessage.com/conversations?phone=${encodeURIComponent(normalizedPhone)}`;

        }

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
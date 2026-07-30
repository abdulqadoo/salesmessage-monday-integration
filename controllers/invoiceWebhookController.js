const { renameItem } = require("../services/mondayService");

const BUILDER_COLUMN_ID = process.env.INVOICES_BUILDER_COLUMN_ID;

async function processInvoiceWebhook(req) {

    try {

        console.log("========== INVOICE WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const event = req.body.event;

        if (!event) {
            return;
        }

        const itemId = event.pulseId;

        if (!itemId) {
            console.log("No pulseId found, skipping.");
            return;
        }

        const builderColumnData = event.columnValues?.[BUILDER_COLUMN_ID];

    const builderValue =
    builderColumnData?.chosenValues?.[0]?.name ||
    builderColumnData?.text ||
    builderColumnData?.value;

        if (!builderValue) {
            console.log("No Builder value found, skipping rename.");
            return;
        }

        const newName = `${builderValue} - ${itemId}`;

        await renameItem(itemId, newName);

        console.log(`✅ Renamed item ${itemId} to "${newName}"`);

    } catch (err) {

        console.error("Invoice Webhook Error:", err);

    }

}

exports.invoiceWebhook = async (req, res) => {

    if (req.body.challenge) {
        return res.status(200).json({ challenge: req.body.challenge });
    }

    res.status(200).json({ success: true });

    await processInvoiceWebhook(req);

};
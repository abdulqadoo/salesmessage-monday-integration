const {
    searchByPhone,
    createItem,
    createUpdate,
    createTimelineItem
} = require("../services/mondayService");

exports.contactWebhook = async (req, res) => {

    try {

        console.log("========== WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const event = req.body.event;
        const data = req.body.data;

        // ===============================
        // CONTACT CREATED / UPDATED
        // ===============================
        if (event === "contact.created" || event === "contact.updated") {

            const contact = {
                name: data.contact?.full_name,
                phone: data.contact?.number
            };

            if (!contact.phone) {
                return res.status(200).json({ success: true });
            }

            const items = await searchByPhone(contact.phone);

            if (items.length === 0) {
                console.log("Creating new Monday item...");
                await createItem(contact);
            } else {
                console.log("Contact already exists in Monday.");
            }

            return res.status(200).json({ success: true });
        }

        // ===============================
        // MESSAGE SENT / RECEIVED
        // ===============================
        if (event === "message.sent" || event === "message.received") {

            const phone = data.contact?.number;

            if (!phone) {
                console.log("No phone number found.");
                return res.status(200).json({ success: true });
            }

            const items = await searchByPhone(phone);

            console.log("Searching:", phone);
            console.log("Items:", items);

            if (items.length === 0) {

                console.log("No matching Monday item found.");

                return res.status(200).json({
                    success: true
                });

            }

            const itemId = items[0].id;

            const messageDate = new Date(
                data.message?.sent_at || data.message?.received_at || new Date()
            );

            let update = "";

            if (event === "message.sent") {

    update = `
OUTGOING SMS

Message:
${data.message.body}

From:
${data.user.full_name}
${data.number.formatted_number}

To:
${data.contact.full_name}
${data.contact.formatted_number}
`;

} else {

    update = `
INCOMING SMS

Message:
${data.message.body}

From:
${data.contact.full_name}
${data.contact.formatted_number}

To:
${data.user?.full_name || "Unknown User"}
${data.number.formatted_number}
`;

}

            console.log("Creating update for item:", itemId);
            console.log(update);

        const title = event === "message.sent"
    ? "Outgoing SMS"
    : "Incoming SMS";

const timestamp =
    data.message.sent_at ||
    data.message.received_at ||
    new Date().toISOString();

await createTimelineItem(
    itemId,
    title,
    update.replace(/\n/g, "<br>"),
    timestamp
);

            console.log("✅ Monday update created.");

            return res.status(200).json({
                success: true
            });

        }

        // ===============================
// TEST TIMELINE
// ===============================
await createTimelineItem(
    "12400579143", // Replace with your actual Monday item ID if different
    "Test SMS",
    "Message:<br>This is a Railway test.<br><br>From:<br>Abdul Qadoos<br><br>To:<br>Ash Berkowitz",
    new Date().toISOString()
);// Ignore unsupported events
        return res.status(200).json({
            success: true
        });

    } catch (err) {

        console.error("Webhook Error:");
        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

};
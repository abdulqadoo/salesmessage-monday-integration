const { getRecentAttachment } = require("../services/salesMessageService");
const {
    searchByPhone,
    createItem,
    createUpdate,
    createTimelineItem,
    addFileToUpdateFromUrl
} = require("../services/mondayService");

const { getRecentAttachment } = require("../services/salesMessageService");

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

            const senderName =
                event === "message.sent"
                    ? data.user?.full_name || "Unknown User"
                    : data.contact?.full_name || "Unknown Contact";

            const senderPhone =
                event === "message.sent"
                    ? data.number?.formatted_number || ""
                    : data.contact?.formatted_number || "";

            const receiverName =
                event === "message.sent"
                    ? data.contact?.full_name || "Unknown Contact"
                    : data.user?.full_name || data.inbox?.name || "Unknown User";

            const receiverPhone =
                event === "message.sent"
                    ? data.contact?.formatted_number || ""
                    : data.number?.formatted_number || "";

            const direction =
                event === "message.sent"
                    ? "OUTGOING SMS"
                    : "INCOMING SMS";

            update = `
${direction}

${data.message.body}

From:
${senderName}
${senderPhone}

To:
${receiverName}
${receiverPhone}
`;

            console.log("Creating update for item:", itemId);
        // TEMPORARY: inspect full message details to find the media field
if (data.message?.type === "mms") {
    await getRecentAttachment();
}
            console.log(update);

            const title = event === "message.sent"
                ? "Outgoing SMS"
                : "Incoming SMS";

            // Using createUpdate (simple Updates tab post) instead of createTimelineItem
            // createTimelineItem requires a custom_activity_id we're skipping for now
           // If this was an MMS, attach the image to the same update
if (data.message?.type === "mms") {

    const attachment = await getRecentAttachment();

    if (attachment) {
        const updateResult = await createUpdate(
            itemId,
            update.replace(/\n/g, "<br>")
        );

        await addFileToUpdateFromUrl(
            updateResult.id,
            attachment.url,
            attachment.name
        );

        console.log("✅ Image attached to Monday update.");
    }

} else {
    await createUpdate(
        itemId,
        update.replace(/\n/g, "<br>")
    );
}

        // Ignore unsupported events
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
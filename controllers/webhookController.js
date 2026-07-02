const {
    searchByPhone,
    createItem,
    createUpdate
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

            const formattedDate = messageDate.toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true
            });

            let update = "";

            if (event === "message.sent") {

                update = `
📤 OUTGOING SMS

━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 From
${data.user?.full_name || "Unknown User"}
${data.number?.formatted_number || data.number?.number || ""}

👥 To
${data.contact?.full_name || "Unknown Contact"}
${data.contact?.formatted_number || data.contact?.number || ""}

💬 Message

${data.message?.body || ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 ${formattedDate}
`;

            } else {

                update = `
📥 INCOMING SMS

━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 From
${data.contact?.full_name || "Unknown Contact"}
${data.contact?.formatted_number || data.contact?.number || ""}

👥 To
${data.user?.full_name || "Unknown User"}
${data.number?.formatted_number || data.number?.number || ""}

💬 Message

${data.message?.body || ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━

🕒 ${formattedDate}
`;

            }

            console.log("Creating update for item:", itemId);
            console.log(update);

            await createUpdate(itemId, update);

            console.log("✅ Monday update created.");

            return res.status(200).json({
                success: true
            });

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
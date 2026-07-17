const { searchByPhone, createItem, connectItems, getItem } = require("../services/mondayService");

const RELATIONSHIP_BOARD_ID = process.env.RELATIONSHIP_BOARD_ID;
const MEETINGS_BOARD_ID = "18415945114";
const MEETINGS_PHONE_COLUMN_ID = "long_text_mm3zh6v2";
const MEETINGS_CONNECT_COLUMN_ID = "board_relation_mm4126wx";

exports.meetingWebhook = async (req, res) => {

    try {

        console.log("========== MEETING WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        if (req.body.challenge) {
            return res.status(200).json({ challenge: req.body.challenge });
        }

        const event = req.body.event;

        if (!event) {
            return res.status(200).json({ success: true });
        }

        const meetingItemId = event.pulseId;

        // Get the phone number value off the new Meetings item
        const meetingItem = await getItem(meetingItemId);

        const phoneColumn = meetingItem?.column_values?.find(
            c => c.id === MEETINGS_PHONE_COLUMN_ID
        );

        // long_text columns store the value as plain text already
        const rawText = phoneColumn?.text || "";

        // Pull out a phone-number-looking sequence of digits from the text
        const phoneMatch = rawText.match(/[\d+][\d\s\-().]{6,}\d/);
        const phone = phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, "") : null;

        if (!phone) {
            console.log("No phone number found in text column, skipping.");
            return res.status(200).json({ success: true });
        }

        // Search Relationship board for matching phone
        const matches = await searchByPhone(phone);

        let relationshipItemId;

        if (matches.length > 0) {

            relationshipItemId = matches[0].id;
            console.log("Found existing Relationship item:", relationshipItemId);

        } else {

            console.log("No match found, creating new Relationship item...");

            const newItem = await createItem({
                name: meetingItem.name,
                phone: phone
            });

            relationshipItemId = newItem.id;

        }

        // Connect the Meetings item to the Relationship item
        await connectItems(
            MEETINGS_BOARD_ID,
            meetingItemId,
            MEETINGS_CONNECT_COLUMN_ID,
            relationshipItemId
        );

        console.log(`✅ Connected meeting ${meetingItemId} to relationship item ${relationshipItemId}`);

        return res.status(200).json({ success: true });

    } catch (err) {

        console.error("Meeting Webhook Error:", err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

};
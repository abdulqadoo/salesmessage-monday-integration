const { searchByEmail, createItemWithEmail, connectItems, getItem } = require("../services/mondayService");

const RELATIONSHIP_BOARD_ID = process.env.RELATIONSHIP_BOARD_ID;
const RELATIONSHIP_EMAIL_COLUMN_ID = process.env.RELATIONSHIP_EMAIL_COLUMN_ID;
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID;
const MEETINGS_EMAIL_COLUMN_ID = process.env.MEETINGS_EMAIL_COLUMN_ID;
const MEETINGS_CONNECT_COLUMN_ID = process.env.MEETINGS_CONNECT_COLUMN_ID;


// =====================================
// EXTRACT CLIENT NAME FROM MEETING TITLE
// e.g. "Call Ash and Akshara Kuduvalli" -> "Akshara Kuduvalli"
// =====================================
function extractClientName(meetingTitle) {

    if (!meetingTitle) {
        return meetingTitle;
    }

    const parts = meetingTitle.split(/\s+and\s+/i);

    if (parts.length > 1) {
        return parts[parts.length - 1].trim();
    }

    return meetingTitle.trim();

}
// =====================================
// EXTRACT SECOND EMAIL FROM SEMICOLON-SEPARATED LIST
// e.g. "ash@valuebuildersgroup.com;akshara.kuduvalli@gmail.com" -> "akshara.kuduvalli@gmail.com"
// =====================================
function extractClientEmail(rawEmailField) {

    if (!rawEmailField) {
        return null;
    }

    const emails = rawEmailField
        .split(";")
        .map(e => e.trim())
        .filter(Boolean);

    if (emails.length >= 2) {
        return emails[1]; // second email = client's email
    }

    // Fallback: only one email present, use it
    return emails[0] || null;

}

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

        const meetingItem = await getItem(meetingItemId);

        const rawEmail = emailColumn?.text;
const email = extractClientEmail(rawEmail);

console.log("Raw email field:", rawEmail, "-> Using:", email);

        const email = emailColumn?.text;

        if (!email) {
            console.log("No email found on meeting item, skipping.");
            return res.status(200).json({ success: true });
        }

        const matches = await searchByEmail(
            RELATIONSHIP_BOARD_ID,
            RELATIONSHIP_EMAIL_COLUMN_ID,
            email
        );

        let relationshipItemId;

        if (matches.length > 0) {

            relationshipItemId = matches[0].id;
            console.log("Found existing Relationship item:", relationshipItemId);

        } else {

            const clientName = extractClientName(meetingItem.name);

            console.log("No match found. Extracted client name:", clientName, "from meeting title:", meetingItem.name);

            const newItem = await createItemWithEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                clientName,
                email
            );

            relationshipItemId = newItem.id;

        }

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
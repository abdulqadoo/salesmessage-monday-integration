const { searchByEmail, createItemWithEmail, connectItems, getItem } = require("../services/mondayService");

const RELATIONSHIP_BOARD_ID = process.env.BOARD_ID;
const RELATIONSHIP_EMAIL_COLUMN_ID = process.env.RELATIONSHIP_EMAIL_COLUMN_ID;
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID;
const MEETINGS_EMAIL_COLUMN_ID = process.env.MEETINGS_EMAIL_COLUMN_ID;
const MEETINGS_CONNECT_COLUMN_ID = process.env.MEETINGS_CONNECT_COLUMN_ID;
const RELATIONSHIP_CONNECT_COLUMN_ID = process.env.RELATIONSHIP_CONNECT_COLUMN_ID;
// Duplicate protection - survives across retries and duplicate webhook fires
// within the same running process
const processedMeetings = new Set();


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
        return emails[1];
    }

    return emails[0] || null;

}


// =====================================
// ACTUAL PROCESSING LOGIC (runs after we've already responded to Monday)
// =====================================
async function processMeetingWebhook(req) {

    try {

        console.log("========== MEETING WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        const event = req.body.event;

        if (!event) {
            return;
        }

        const meetingItemId = event.pulseId;

        if (!meetingItemId) {
            console.log("No pulseId found, skipping.");
            return;
        }

        if (processedMeetings.has(meetingItemId)) {
            console.log("Duplicate meeting webhook ignored:", meetingItemId);
            return;
        }

        processedMeetings.add(meetingItemId);

        const rawEmail = event.columnValues?.[MEETINGS_EMAIL_COLUMN_ID]?.value;
        const email = extractClientEmail(rawEmail);

        console.log("Raw email field:", rawEmail, "-> Using:", email);

        if (!email) {
            console.log("No email found on meeting item, skipping.");
            return;
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

            const meetingItem = await getItem(meetingItemId);
            const clientName = extractClientName(meetingItem?.name || event.pulseName);

            console.log("No match found. Extracted client name:", clientName);

            const newItem = await createItemWithEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                clientName,
                email
            );

            relationshipItemId = newItem.id;

        }

        // Connect Meetings item -> Relationship item
await connectItems(
    MEETINGS_BOARD_ID,
    meetingItemId,
    MEETINGS_CONNECT_COLUMN_ID,
    relationshipItemId
);

// Connect Relationship item -> Meetings item (explicit, don't rely on two-way auto-sync)
await connectItems(
    RELATIONSHIP_BOARD_ID,
    relationshipItemId,
    RELATIONSHIP_CONNECT_COLUMN_ID,
    meetingItemId
);


        console.log(`✅ Connected meeting ${meetingItemId} to relationship item ${relationshipItemId}`);

    } catch (err) {

        console.error("Meeting Webhook Error:", err);

    }

}


exports.meetingWebhook = async (req, res) => {

    if (req.body.challenge) {
        return res.status(200).json({ challenge: req.body.challenge });
    }

    res.status(200).json({ success: true });

    await processMeetingWebhook(req);

};
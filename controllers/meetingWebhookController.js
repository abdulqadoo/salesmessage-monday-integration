const { searchByEmail, createItemWithEmail, connectItems, getItem, updateColumnValues, searchByPhoneForCleanup, deleteItem } = require("../services/mondayService");

const RELATIONSHIP_BOARD_ID = process.env.BOARD_ID;
const RELATIONSHIP_EMAIL_COLUMN_ID = process.env.RELATIONSHIP_EMAIL_COLUMN_ID;
const RELATIONSHIP_PHONE_COLUMN_ID = process.env.PHONE_COLUMN;
const RELATIONSHIP_STATUS_COLUMN_ID = process.env.RELATIONSHIP_STATUS_COLUMN_ID || "color_mm3hgyby";
const MEETINGS_STATUS_COLUMN_ID = process.env.MEETINGS_STATUS_COLUMN_ID || "color_mm3y8n81";
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID;
const MEETINGS_EMAIL_COLUMN_ID = process.env.MEETINGS_EMAIL_COLUMN_ID;
const MEETINGS_PHONE_COLUMN_ID = process.env.MEETINGS_PHONE_COLUMN_ID;
const MEETINGS_CONNECT_COLUMN_ID = process.env.MEETINGS_CONNECT_COLUMN_ID;
const RELATIONSHIP_CONNECT_COLUMN_ID = process.env.RELATIONSHIP_CONNECT_COLUMN_ID;

// Duplicate protection - survives across retries and duplicate webhook fires
// within the same running process
const processedMeetings = new Set();


// =====================================
// YOUR TEAM'S OWN EMAIL DOMAIN
// Any email ending in this domain is treated as internal, never a client.
// =====================================
const INTERNAL_EMAIL_DOMAIN = "valuebuildersgroup.com";


// =====================================
// SPECIFIC INTERNAL ADDRESSES ON OUTSIDE DOMAINS
// =====================================
const INTERNAL_EMAILS = [
    "ashonfire@gmail.com"
];


function isInternalEmail(email) {

    const lower = email.toLowerCase();

    return lower.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`) ||
        INTERNAL_EMAILS.includes(lower);

}


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


function extractAllEmails(rawEmailField) {

    if (!rawEmailField) {
        return [];
    }

    const matches = rawEmailField.match(/[^\s;,]+@[^\s;,]+\.[^\s;,]+/g);

    return matches ? matches.map(e => e.trim()) : [];

}


function extractPhoneFromText(rawText) {

    if (!rawText) {
        return null;
    }

    const match = rawText.match(
        /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/
    );

    if (!match) {
        return null;
    }

    const digits = match[0].replace(/\D/g, "");

    if (digits.length === 10) {
        return `+1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
    }

    return digits;

}


function determineMeetingStatus(itemName, notesText) {

    const combined = `${itemName || ""} ${notesText || ""}`.toLowerCase();

    const hasOnlineKeyword = /\bonline meeting\b/.test(combined) || /\bonline\b/.test(combined);
    const hasMeetingLink = combined.includes("zoom.us") || combined.includes("meet.google.com");

    if (hasOnlineKeyword || hasMeetingLink) {
        return "Online Meeting";
    }

    if (/\bcall\b/.test(combined)) {
        return "Call Booked";
    }

    if (/\bsite visit\b/.test(combined)) {
        return "Site Visit Booked";
    }

    return null;

}


// =====================================
// DELETE ANY PHONE-ONLY SPAM/DUPLICATE ITEMS ON THE RELATIONSHIP BOARD
// THAT MATCH THIS PHONE NUMBER. Runs independently, every time, regardless
// of whether the email search above found/created anything. Only deletes
// items that have NO email on file — never touches a real contact record.
// =====================================
async function cleanupPhoneOnlyDuplicates(phone) {

    if (!phone) {
        return;
    }

    const phoneMatches = await searchByPhoneForCleanup(
        RELATIONSHIP_BOARD_ID,
        RELATIONSHIP_PHONE_COLUMN_ID,
        RELATIONSHIP_EMAIL_COLUMN_ID,
        phone
    );

    for (const item of phoneMatches) {

        const emailText = item.column_values?.[0]?.text;

        if (!emailText) {

            console.log("🗑️ Deleting phone-only spam/duplicate item:", item.id, "(name:", item.name + ")");
            await deleteItem(item.id);

        } else {

            console.log("Phone match found but has an email on file, leaving it alone:", item.id);

        }

    }

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

        // Read notes/phone text up front - needed for cleanup regardless of
        // whether a valid client email is found below.
        const rawNotesText =
            event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.text ||
            event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.value;

        const extractedPhone = extractPhoneFromText(rawNotesText);

        // Independent cleanup step - runs regardless of email match outcome.
        await cleanupPhoneOnlyDuplicates(extractedPhone);

        const rawEmail = event.columnValues?.[MEETINGS_EMAIL_COLUMN_ID]?.value;
        const allEmails = extractAllEmails(rawEmail);

        const clientEmails = allEmails.filter(e => !isInternalEmail(e));

        console.log("Raw email field:", rawEmail, "-> All emails:", allEmails, "-> Client emails only:", clientEmails);

        if (clientEmails.length === 0) {
            console.log("No client (non-internal) email found on meeting item, skipping.");
            return;
        }

        let relationshipItemId = null;
        let matchedEmail = null;

        for (const candidateEmail of clientEmails) {

            const matches = await searchByEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                candidateEmail
            );

            if (matches.length > 0) {
                relationshipItemId = matches[0].id;
                matchedEmail = candidateEmail;
                break;
            }

        }

        if (relationshipItemId) {

            console.log(`Found existing Relationship item (matched on ${matchedEmail}):`, relationshipItemId);

        } else {

            const emailToUse = clientEmails[0];

            const meetingItem = await getItem(meetingItemId);

            const itemName = extractClientName(meetingItem?.name || event.pulseName);

            console.log("No match found for any client email. Using:", emailToUse);
            console.log("Using item name:", itemName);
            console.log("Raw phone field:", rawNotesText, "-> Extracted phone:", extractedPhone);

            const newItem = await createItemWithEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                itemName,
                emailToUse,
                RELATIONSHIP_PHONE_COLUMN_ID,
                extractedPhone
            );

            relationshipItemId = newItem.id;

        }

        await updateColumnValues(RELATIONSHIP_BOARD_ID, relationshipItemId, {
            [RELATIONSHIP_STATUS_COLUMN_ID]: { label: "Discovery" }
        });

        console.log("✅ Status set to Discovery on relationship item", relationshipItemId);

        const meetingStatus = determineMeetingStatus(event.pulseName, rawNotesText);

        if (meetingStatus) {

            await updateColumnValues(MEETINGS_BOARD_ID, meetingItemId, {
                [MEETINGS_STATUS_COLUMN_ID]: { label: meetingStatus }
            });

            console.log(`✅ Status set to "${meetingStatus}" on meeting item`, meetingItemId);

        } else {

            console.log("No status keyword matched - leaving status column untouched on meeting item", meetingItemId);

        }

        await connectItems(
            MEETINGS_BOARD_ID,
            meetingItemId,
            MEETINGS_CONNECT_COLUMN_ID,
            relationshipItemId
        );

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
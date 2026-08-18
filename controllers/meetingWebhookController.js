const { searchByEmail, createItemWithEmail, connectItems, getItem, updateColumnValues } = require("../services/mondayService");

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
const { searchByEmail, searchByPhone, createItemWithEmail, connectItems, getItem, updateColumnValues, deleteItem } = require("../services/mondayService");
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
// Some team/staff use personal email addresses (e.g. Gmail) instead of
// the company domain — domain filtering alone can't catch these, so they
// need to be listed explicitly. Add any other staff personal emails here.
// =====================================
const INTERNAL_EMAILS = [
    "ashonfire@gmail.com"
];


function isInternalEmail(email) {

    const lower = email.toLowerCase();

    return lower.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`) ||
        INTERNAL_EMAILS.includes(lower);

}


// =====================================
// EXTRACT CLIENT NAME FROM MEETING TITLE
// e.g. "Ash Berkowitz and Jennifer Gardner" -> "Jennifer Gardner"
// If there's no "and" in the title, the whole title is used as-is.
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
// EXTRACT ALL EMAILS FROM THE FIELD, REGARDLESS OF SEPARATOR
// Handles space-separated, semicolon-separated, or comma-separated lists,
// and single emails, all with one regex.
// e.g. "ash@valuebuildersgroup.com gorayasaqib688@gmail.com" -> both emails
// =====================================
function extractAllEmails(rawEmailField) {

    if (!rawEmailField) {
        return [];
    }

    const matches = rawEmailField.match(/[^\s;,]+@[^\s;,]+\.[^\s;,]+/g);

    return matches ? matches.map(e => e.trim()) : [];

}


// =====================================
// EXTRACT PHONE NUMBER FROM FREE-FORM CALENDAR TEXT
// e.g. "Ash to call 6506607551\nPlease provide your address..." -> "+16506607551"
// Deliberately looks for a 10-digit (or 11-digit w/ leading 1) run of digits,
// with optional separators, so it doesn't accidentally grab a zip code (5 digits)
// or digits embedded inside URLs/tokens (mixed alphanumeric, won't match).
// =====================================
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

    // Unexpected length — return raw digits rather than silently drop it,
    // so it's still visible/reviewable on the board instead of vanishing.
    return digits;

}


// =====================================
// DETERMINE MEETING STATUS FROM NAME + NOTES
// Checked in priority order:
//   1. Online Meeting  — "online"/"online meeting" mentioned, OR a Zoom/
//      Google Meet link is present anywhere in the name or notes
//   2. Call Booked     — item name contains "Call"
//   3. Site Visit Booked — item name contains "Site Visit"
// Returns null if none match — caller should leave the status column
// untouched in that case, since there is no valid "default" label on
// this column (it does NOT have a "Discovery" option).
// =====================================
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
        const allEmails = extractAllEmails(rawEmail);

        // Drop your own team's email(s) entirely — never search or store these,
        // regardless of how many emails are on the meeting (2, 4, 5, whatever).
        const clientEmails = allEmails.filter(e => !isInternalEmail(e));

        console.log("Raw email field:", rawEmail, "-> All emails:", allEmails, "-> Client emails only:", clientEmails);

        if (clientEmails.length === 0) {
            console.log("No client (non-internal) email found on meeting item, skipping.");
            return;
        }
const rawPhoneTextForCleanup =
    event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.text ||
    event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.value;

const phoneForCleanup = extractPhoneFromText(rawPhoneTextForCleanup);

if (phoneForCleanup) {

    const phoneMatches = await searchByPhone(
        RELATIONSHIP_BOARD_ID,
        RELATIONSHIP_PHONE_COLUMN_ID,
        phoneForCleanup
    );

    for (const duplicate of phoneMatches) {

        const hasEmail = duplicate.column_values?.find(
            cv => cv.id === RELATIONSHIP_EMAIL_COLUMN_ID
        )?.text;

        if (!hasEmail) {

            console.log("🗑️ Deleting spam/duplicate phone-only item:", duplicate.id);
            await deleteItem(duplicate.id);

        } else {

            console.log("Phone match found but has an email on file, leaving it alone:", duplicate.id);

        }

    }

}
        // Check each CLIENT email against the Relationship board, in order.
        // First one that matches an existing item wins.
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

        // Read the meeting's long-text/notes field once, up front — used for
        // both phone extraction and status keyword matching, regardless of
        // whether we end up creating a new item or linking an existing one.
        const rawNotesText =
            event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.text ||
            event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.value;

        if (relationshipItemId) {

            console.log(`Found existing Relationship item (matched on ${matchedEmail}):`, relationshipItemId);

        } else {

            // Use the FIRST client email only — this is the one and only
            // email that gets written to the new Relationship item.
            const emailToUse = clientEmails[0];

            const meetingItem = await getItem(meetingItemId);

            // Use the exact same name as the meeting item, but if it's in
            // "Person A and Person B" format, only keep the second name.
            const itemName = extractClientName(meetingItem?.name || event.pulseName);

            const phone = extractPhoneFromText(rawNotesText);

            console.log("No match found for any client email. Using:", emailToUse);
            console.log("Using item name:", itemName);
            console.log("Raw phone field:", rawNotesText, "-> Extracted phone:", phone);

            const newItem = await createItemWithEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                itemName,
                emailToUse,
                RELATIONSHIP_PHONE_COLUMN_ID,
                phone
            );

            relationshipItemId = newItem.id;

        }

        // Set the Relationship item's status to "Discovery" whether it was
        // just created or already existed and we're linking to it.
        await updateColumnValues(RELATIONSHIP_BOARD_ID, relationshipItemId, {
            [RELATIONSHIP_STATUS_COLUMN_ID]: { label: "Discovery" }
        });

        console.log("✅ Status set to Discovery on relationship item", relationshipItemId);

        // Determine status from the meeting's name + notes (keywords like
        // "Online", a Zoom/Meet link, "Call", or "Site Visit"). If nothing
        // matches, leave the status column untouched — there is no valid
        // "default" option on this column to fall back to.
        const meetingStatus = determineMeetingStatus(event.pulseName, rawNotesText);

        if (meetingStatus) {

            await updateColumnValues(MEETINGS_BOARD_ID, meetingItemId, {
                [MEETINGS_STATUS_COLUMN_ID]: { label: meetingStatus }
            });

            console.log(`✅ Status set to "${meetingStatus}" on meeting item`, meetingItemId);

        } else {

            console.log("No status keyword matched - leaving status column untouched on meeting item", meetingItemId);

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
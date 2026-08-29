const { searchByEmail, createItemWithEmail, connectItems, getItem, updateColumnValues, searchByPhoneForCleanup, deleteItem } = require("../services/mondayService");
const { findMatchingCalendarEvent, addMondayLinkToEvent } = require("../services/calendarService");

const RELATIONSHIP_BOARD_ID = process.env.BOARD_ID;
const RELATIONSHIP_EMAIL_COLUMN_ID = process.env.RELATIONSHIP_EMAIL_COLUMN_ID;
const RELATIONSHIP_PHONE_COLUMN_ID = process.env.PHONE_COLUMN;
const RELATIONSHIP_STATUS_COLUMN_ID = process.env.RELATIONSHIP_STATUS_COLUMN_ID || "color_mm3hgyby";
const RELATIONSHIP_LEAD_DATE_COLUMN_ID = process.env.RELATIONSHIP_LEAD_DATE_COLUMN_ID || "date_mm2wmqy8";
const MEETINGS_STATUS_COLUMN_ID = process.env.MEETINGS_STATUS_COLUMN_ID || "color_mm3y8n81";
const MEETINGS_CREATION_LOG_COLUMN_ID = process.env.MEETINGS_CREATION_LOG_COLUMN_ID || "pulse_log_mm5hztt4";
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID;
const MEETINGS_EMAIL_COLUMN_ID = process.env.MEETINGS_EMAIL_COLUMN_ID;
const MEETINGS_PHONE_COLUMN_ID = process.env.MEETINGS_PHONE_COLUMN_ID;
const MEETINGS_CONNECT_COLUMN_ID = process.env.MEETINGS_CONNECT_COLUMN_ID;
const RELATIONSHIP_CONNECT_COLUMN_ID = process.env.RELATIONSHIP_CONNECT_COLUMN_ID;
const MEETINGS_DATE_COLUMN_ID = process.env.MEETINGS_DATE_COLUMN_ID || "date_mm3ybgbv";
const MEETINGS_CALENDAR_LINK_COLUMN = process.env.MEETINGS_CALENDAR_LINK_COLUMN;
const MONDAY_ACCOUNT_SUBDOMAIN = process.env.MONDAY_ACCOUNT_SUBDOMAIN || "YOUR-MONDAY-SUBDOMAIN";

// NEW: Action Status sync (Meetings status -> Relationship Action Status)
const RELATIONSHIP_ACTION_STATUS_COLUMN_ID = process.env.RELATIONSHIP_ACTION_STATUS_COLUMN_ID || "color_mm2w2gr8";
const MEETINGS_TO_ACTION_STATUS_MAP = {
    "Call Booked": "Booked Call",
    "Online Meeting": "Booked Online Meeting"
};

const processedMeetings = new Set();


const INTERNAL_EMAIL_DOMAIN = "valuebuildersgroup.com";


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

    return matches ? matches.map(e => e.trim().toLowerCase()) : [];

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


function buildStartDateTime(event) {

    const dateInfo = event.columnValues?.[MEETINGS_DATE_COLUMN_ID];

    if (!dateInfo?.date) {
        return null;
    }

    const time = dateInfo.time || "00:00:00";

    return `${dateInfo.date}T${time}`;

}


function extractCreationDate(meetingItem) {

    const creationLogColumn = meetingItem?.column_values?.find(
        cv => cv.id === MEETINGS_CREATION_LOG_COLUMN_ID
    );

    if (!creationLogColumn?.value) {
        return null;
    }

    try {

        const parsed = JSON.parse(creationLogColumn.value);
        const createdAt = parsed.created_at;

        if (!createdAt) {
            return null;
        }

        const date = isNaN(createdAt)
            ? new Date(createdAt)
            : new Date(Number(createdAt) * 1000);

        if (isNaN(date.getTime())) {
            return null;
        }

        return date.toISOString().split("T")[0];

    } catch (err) {

        console.log("Failed to parse creation_log column value:", err.message);
        return null;

    }

}


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


// NEW: small delay helper, used only for the final Action Status sync step.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


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

        const rawNotesText =
            event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.text ||
            event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.value;

        const extractedPhone = extractPhoneFromText(rawNotesText);

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
            const leadDate = extractCreationDate(meetingItem);

            console.log("No match found for any client email. Using:", emailToUse);
            console.log("Using item name:", itemName);
            console.log("Raw phone field:", rawNotesText, "-> Extracted phone:", extractedPhone);
            console.log("Extracted lead date:", leadDate);

            const newItem = await createItemWithEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                itemName,
                emailToUse,
                RELATIONSHIP_PHONE_COLUMN_ID,
                extractedPhone
            );

            relationshipItemId = newItem.id;

            if (leadDate) {

                await updateColumnValues(RELATIONSHIP_BOARD_ID, relationshipItemId, {
                    [RELATIONSHIP_LEAD_DATE_COLUMN_ID]: { date: leadDate }
                });

                console.log("✅ Lead Date set to", leadDate, "on relationship item", relationshipItemId);

            }

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

        const startDateTime = buildStartDateTime(event);

        if (startDateTime && MEETINGS_CALENDAR_LINK_COLUMN) {

            const matchedEvent = await findMatchingCalendarEvent({
                title: event.pulseName,
                startDateTime
            });

            if (matchedEvent) {

                await updateColumnValues(MEETINGS_BOARD_ID, meetingItemId, {
                    [MEETINGS_CALENDAR_LINK_COLUMN]: {
                        url: matchedEvent.htmlLink,
                        text: "Open in Google Calendar"
                    }
                });

                console.log("✅ Calendar link saved to Monday item");

                const mondayItemUrl = `https://${MONDAY_ACCOUNT_SUBDOMAIN}.monday.com/boards/${RELATIONSHIP_BOARD_ID}/pulses/${relationshipItemId}`;
                await addMondayLinkToEvent(matchedEvent.eventId, mondayItemUrl);

            } else {

                console.log("No matching Google Calendar event found for this meeting - leaving link column empty.");

            }

        } else {

            console.log("Could not build a start time from meeting item, or link column not configured - skipping calendar search.");

        }

        // NEW: ACTION STATUS SYNC - always the LAST step, after a short
        // delay, so every write above has settled first.
        await sleep(1500);

        const effectiveMeetingStatus =
            meetingStatus ||
            event.columnValues?.[MEETINGS_STATUS_COLUMN_ID]?.label?.text ||
            event.columnValues?.[MEETINGS_STATUS_COLUMN_ID]?.label ||
            event.columnValues?.[MEETINGS_STATUS_COLUMN_ID]?.text;

        console.log("Effective meeting status for Action Status sync:", effectiveMeetingStatus);

        const mappedActionStatus = MEETINGS_TO_ACTION_STATUS_MAP[effectiveMeetingStatus];

        if (mappedActionStatus) {

            await updateColumnValues(RELATIONSHIP_BOARD_ID, relationshipItemId, {
                [RELATIONSHIP_ACTION_STATUS_COLUMN_ID]: { label: mappedActionStatus }
            });

            console.log(`✅ Relationship Action Status set to "${mappedActionStatus}" (from meeting status "${effectiveMeetingStatus}")`);

        } else {

            console.log("Meeting status did not match a known Action Status mapping - leaving it unchanged. Value was:", effectiveMeetingStatus);

        }

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
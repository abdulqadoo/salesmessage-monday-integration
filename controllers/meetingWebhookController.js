const { searchByEmail, createItemWithEmail, connectItems, getItem, updateColumnValues } = require("../services/mondayService");
const { findMatchingCalendarEvent, addMondayLinkToEvent } = require("../services/calendarService");

const RELATIONSHIP_BOARD_ID = process.env.BOARD_ID;
const RELATIONSHIP_EMAIL_COLUMN_ID = process.env.RELATIONSHIP_EMAIL_COLUMN_ID;
const RELATIONSHIP_PHONE_COLUMN_ID = process.env.PHONE_COLUMN;
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID;
const MEETINGS_EMAIL_COLUMN_ID = process.env.MEETINGS_EMAIL_COLUMN_ID;
const MEETINGS_PHONE_COLUMN_ID = process.env.MEETINGS_PHONE_COLUMN_ID;
const MEETINGS_CONNECT_COLUMN_ID = process.env.MEETINGS_CONNECT_COLUMN_ID;
const RELATIONSHIP_CONNECT_COLUMN_ID = process.env.RELATIONSHIP_CONNECT_COLUMN_ID;
const MEETINGS_DATE_COLUMN_ID = process.env.MEETINGS_DATE_COLUMN_ID || "date_mm3ybgbv";
const MEETINGS_CALENDAR_LINK_COLUMN = process.env.MEETINGS_CALENDAR_LINK_COLUMN;
const MONDAY_ACCOUNT_SUBDOMAIN = process.env.MONDAY_ACCOUNT_SUBDOMAIN || "YOUR-MONDAY-SUBDOMAIN";

const processedMeetings = new Set();


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


function buildStartDateTime(event) {

    const dateInfo = event.columnValues?.[MEETINGS_DATE_COLUMN_ID];

    if (!dateInfo?.date) {
        return null;
    }

    const time = dateInfo.time || "00:00:00";

    return `${dateInfo.date}T${time}`;

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

            const rawPhoneText =
                event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.text ||
                event.columnValues?.[MEETINGS_PHONE_COLUMN_ID]?.value;

            const phone = extractPhoneFromText(rawPhoneText);

            console.log("No match found. Extracted client name:", clientName);
            console.log("Raw phone field:", rawPhoneText, "-> Extracted phone:", phone);

            const newItem = await createItemWithEmail(
                RELATIONSHIP_BOARD_ID,
                RELATIONSHIP_EMAIL_COLUMN_ID,
                clientName,
                email,
                RELATIONSHIP_PHONE_COLUMN_ID,
                phone
            );

            relationshipItemId = newItem.id;

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

                const mondayItemUrl = `https://${MONDAY_ACCOUNT_SUBDOMAIN}.monday.com/boards/${MEETINGS_BOARD_ID}/pulses/${meetingItemId}`;
                await addMondayLinkToEvent(matchedEvent.eventId, mondayItemUrl);

            } else {

                console.log("No matching Google Calendar event found for this meeting - leaving link column empty.");

            }

        } else {

            console.log("Could not build a start time from meeting item, or link column not configured - skipping calendar search.");

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
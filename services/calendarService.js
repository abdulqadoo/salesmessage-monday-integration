const calendar = require("../config/google");

const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;


function getCalendarClient() {
    return calendar;
}


function normalizeTitle(title) {
    return String(title || "").toLowerCase().replace(/\s+/g, " ").trim();
}


async function findMatchingCalendarEvent({ title, startDateTime, windowMinutesBefore = 60, windowMinutesAfter = 60 }) {

    const calendarClient = getCalendarClient();

    try {

        const centerTime = new Date(startDateTime);

        if (isNaN(centerTime.getTime())) {
            console.log("Invalid startDateTime provided, cannot search calendar:", startDateTime);
            return null;
        }

        const timeMin = new Date(centerTime.getTime() - windowMinutesBefore * 60 * 1000).toISOString();
        const timeMax = new Date(centerTime.getTime() + windowMinutesAfter * 60 * 1000).toISOString();

        console.log("====== CALENDAR SEARCH ======");
        console.log("Title:", title, "| Window:", timeMin, "->", timeMax);

        console.log("DEBUG calendarId being used:", JSON.stringify(GOOGLE_CALENDAR_ID));
        console.log("DEBUG service account email:", JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email);

        const response = await calendarClient.events.list({
            calendarId: GOOGLE_CALENDAR_ID,
            timeMin,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 50
        });

        const events = response.data.items || [];

        console.log(
            "Candidate events found:",
            events.map(e => ({ id: e.id, summary: e.summary, start: e.start?.dateTime }))
        );

        if (events.length === 0) {
            return null;
        }

        const normalizedTarget = normalizeTitle(title);

        let match = events.find(e => normalizeTitle(e.summary) === normalizedTarget);

        if (!match) {
            match = events.find(e =>
                normalizeTitle(e.summary).includes(normalizedTarget) ||
                normalizedTarget.includes(normalizeTitle(e.summary))
            );
        }

        if (!match) {
            console.log("No title match found among candidates in this time window.");
            return null;
        }

        console.log("✅ Matched calendar event:", match.summary, match.id);

        return {
            eventId: match.id,
            htmlLink: match.htmlLink,
            summary: match.summary,
            start: match.start?.dateTime
        };

    } catch (error) {

        console.log("====== CALENDAR SEARCH ERROR ======");
        console.log(error.response?.data || error.message);
        return null;

    }

}


async function addMondayLinkToEvent(eventId, mondayItemUrl) {

    const calendarClient = getCalendarClient();

    try {

        const existing = await calendarClient.events.get({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId
        });

        const existingDescription = existing.data.description || "";

        const updatedDescription = existingDescription.includes(mondayItemUrl)
            ? existingDescription
            : `${existingDescription}\n\nMonday Item: ${mondayItemUrl}`.trim();

        await calendarClient.events.patch({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId,
            requestBody: {
                description: updatedDescription
            }
        });

        console.log("✅ Monday link added to Google Calendar event:", eventId);

    } catch (error) {

        console.log("====== ADD MONDAY LINK ERROR ======");
        console.log(error.response?.data || error.message);

    }

}

module.exports = {
    findMatchingCalendarEvent,
    addMondayLinkToEvent
};
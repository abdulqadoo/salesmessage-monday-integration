async function addMondayLinkToEvent(eventId, mondayItemUrl) {

    const calendar = getCalendarClient();

    try {

        const existing = await calendar.events.get({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId
        });

        const existingDescription = existing.data.description || "";

        const updatedDescription = existingDescription.includes(mondayItemUrl)
            ? existingDescription
            : `${existingDescription}\n\nMonday Item: ${mondayItemUrl}`.trim();

        await calendar.events.patch({
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
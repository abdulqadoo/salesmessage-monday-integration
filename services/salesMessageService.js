const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


async function fetchRecentAttachments() {

    const response = await axios.get(
        "https://api.salesmessage.com/pub/v2.3/attachments/recently",
        {
            headers: {
                Authorization: `Bearer ${SALESMESSAGE_API_TOKEN}`
            }
        }
    );

    return response.data || [];
}


/**
 * Looks up the attachment for a specific message.
 * Retries several times (instead of one fixed wait) since
 * Salesmsg may still be processing the image.
 * Also flags any case where more than one attachment matches
 * the same message_id, since that would explain wrong/previous
 * images being picked up.
 */
async function getRecentAttachment(messageId, options = {}) {

    const maxAttempts = options.maxAttempts || 5;
    const delayMs = options.delayMs || 3000;


    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        await sleep(delayMs);

        try {

            const attachments = await fetchRecentAttachments();

            if (!attachments.length) {
                console.log(`[Attempt ${attempt}/${maxAttempts}] No attachments returned yet`);
                continue;
            }


            const matches = attachments.filter(a =>
                String(a.message_id) === String(messageId) &&
                a.type === "image" &&
                a.processing === 0 &&
                a.is_allowed_for_media_url === true
            );


            if (matches.length === 0) {

                console.log(
                    `[Attempt ${attempt}/${maxAttempts}] No matching attachment yet for message:`,
                    messageId
                );

                // Diagnostic: show the closest candidates (by message_id only,
                // ignoring the other filters) so we can see WHY they failed
                // to match — wrong type, still processing, or not allowed yet.
                const closeButNoMatch = attachments.filter(a =>
                    String(a.message_id) === String(messageId)
                );

                if (closeButNoMatch.length > 0) {
                    console.log(
                        `[Attempt ${attempt}/${maxAttempts}] Found ${closeButNoMatch.length} attachment(s) with matching message_id, but they failed other filters:`,
                        JSON.stringify(closeButNoMatch, null, 2)
                    );
                } else {
                    console.log(
                        `[Attempt ${attempt}/${maxAttempts}] No attachment in the list has message_id ${messageId} at all. Sample of what came back:`,
                        JSON.stringify(attachments.slice(0, 3), null, 2)
                    );
                }

                continue;
            }


            if (matches.length > 1) {

                // If this ever logs, it CONFIRMS the collision theory —
                // multiple attachments are sharing the same message_id.
                console.log(
                    "⚠️ COLLISION: multiple attachments matched the same message_id:",
                    messageId,
                    JSON.stringify(matches, null, 2)
                );

            }


            const image = matches[0];

            return {
                id: image.id,
                url: image.source,
                name: image.name,
                contentType: image.content_type,
                messageId: image.message_id
            };


        } catch (err) {

            console.log(
                `[Attempt ${attempt}/${maxAttempts}] Attachment Error:`,
                err.response?.data || err.message
            );

        }

    }


    console.log(
        "No matching attachment found after all retries for message:",
        messageId
    );

    return null;

}


module.exports = {
    getRecentAttachment
};
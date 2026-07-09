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
 * Grabs the most recently uploaded image attachment.
 *
 * IMPORTANT: Salesmsg's /attachments/recently endpoint does NOT include
 * a message_id field (confirmed from live payloads), so there is no way
 * to filter this list down to "the attachment for exactly this message."
 * The most reliable available signal is recency: this endpoint returns
 * items newest-first, so we take the top valid image.
 *
 * This restores the previously-working behavior. Known limitation:
 * if two image messages (in either direction) are sent within the same
 * short window, this can still pick up the wrong one, since the API
 * gives us no per-message correlation. If that happens, it needs to be
 * reported to Salesmsg support as an API gap — not something fixable
 * purely in our code.
 */
async function getRecentAttachment(messageId, options = {}) {

    const maxAttempts = options.maxAttempts || 5;
    const delayMs = options.delayMs || 3000;


    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        await sleep(delayMs);

        try {

            const attachments = await fetchRecentAttachments();
console.log("========== ATTACHMENTS ==========");

attachments.forEach((a) => {
    console.log({
        id: a.id,
        message_id: a.message_id,
        conversation_id: a.conversation_id,
        name: a.name,
        created_at: a.created_at,
        processing: a.processing
    });
});

console.log("================================");
            if (!attachments.length) {
                console.log(`[Attempt ${attempt}/${maxAttempts}] No attachments returned yet`);
                continue;
            }

            const validImages = attachments.filter(a =>
                a.type === "image" &&
                a.processing === 0 &&
                a.is_allowed_for_media_url === true
            );

            if (validImages.length === 0) {
                console.log(`[Attempt ${attempt}/${maxAttempts}] No ready image attachments yet`);
                continue;
            }

            // Newest first (list order) — take the top one.
            const image = validImages[0];

            console.log(
                `[Attempt ${attempt}/${maxAttempts}] Using most recent ready image:`,
                image.name,
                image.id
            );

            return {
                id: image.id,
                url: image.source,
                name: image.name,
                contentType: image.content_type
            };


        } catch (err) {

            console.log(
                `[Attempt ${attempt}/${maxAttempts}] Attachment Error:`,
                err.response?.data || err.message
            );

        }

    }


    console.log(
        "No attachment found after all retries for message:",
        messageId
    );

    return null;

}


module.exports = {
    getRecentAttachment
};
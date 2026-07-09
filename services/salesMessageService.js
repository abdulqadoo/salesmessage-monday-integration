const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * Fetches the message record directly from its conversation.
 * This is scoped to the exact conversation + message id, unlike
 * /attachments/recently which returns an account-wide list with
 * no message_id field to correlate against.
 */
async function fetchMessageFromConversation(conversationId, messageId) {

    const candidateUrls = [
        `https://api.salesmessage.com/pub/v2.2/conversations/${conversationId}/messages`,
        `https://api.salesmessage.com/pub/v2.3/conversations/${conversationId}/messages`,
        `https://api.salesmessage.com/pub/v2.2/conversations/${conversationId}`,
        `https://api.salesmessage.com/pub/v2.3/conversations/${conversationId}`
    ];

    for (const url of candidateUrls) {

        try {

            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${SALESMESSAGE_API_TOKEN}`
                }
            });

            console.log(`✅ Endpoint worked: ${url}`);

            const body = response.data?.data || response.data;

            // Could be an array of messages, or a single conversation
            // object with a nested messages array — handle both.
            const messages = Array.isArray(body)
                ? body
                : (body?.messages || [body]);

            const match = messages.find(m =>
                String(m.id) === String(messageId)
            );

            if (match) {
                return { messages, match, workingUrl: url };
            }

            console.log(`Endpoint ${url} responded but message ${messageId} not found in it yet.`);

        } catch (err) {

            console.log(
                `Endpoint failed (${url}):`,
                err.response?.status,
                err.response?.data?.message || err.message
            );

        }

    }

    return { messages: [], match: null };
}


/**
 * Looks up the attachment for a specific message by fetching that
 * exact message from its conversation and reading its own attachment
 * data, instead of guessing from an unrelated "recently uploaded" list.
 */
async function getRecentAttachment(messageId, options = {}) {

    const conversationId = options.conversationId;

    if (!conversationId) {
        console.log("getRecentAttachment called without conversationId — cannot look up message-scoped attachment.");
        return null;
    }

    const maxAttempts = options.maxAttempts || 5;
    const delayMs = options.delayMs || 3000;


    for (let attempt = 1; attempt <= maxAttempts; attempt++) {

        await sleep(delayMs);

        try {

            const { messages, match } = await fetchMessageFromConversation(conversationId, messageId);

            if (!match) {
                console.log(
                    `[Attempt ${attempt}/${maxAttempts}] Message ${messageId} not found yet in conversation ${conversationId}.`
                );
                continue;
            }

            // Log the full matched message once so we can see exactly
            // where the attachment data lives on it (field name may be
            // "attachments", "media", "files", etc — adjust below once seen).
            console.log(
                `[Attempt ${attempt}/${maxAttempts}] Found message record:`,
                JSON.stringify(match, null, 2)
            );

            const attachment =
                match.attachments?.[0] ||
                match.media?.[0] ||
                match.files?.[0] ||
                null;

            if (!attachment) {
                console.log(
                    `[Attempt ${attempt}/${maxAttempts}] Message found but no attachment field populated yet.`
                );
                continue;
            }

            return {
                id: attachment.id,
                url: attachment.source || attachment.url,
                name: attachment.name,
                contentType: attachment.content_type,
                messageId: messageId
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
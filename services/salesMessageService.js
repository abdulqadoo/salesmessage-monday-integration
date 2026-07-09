const axios = require("axios");

const SALESMESSAGE_API_TOKEN = process.env.SALESMESSAGE_API_TOKEN;


function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


function parseTime(value) {
    if (!value) {
        return null;
    }

    const timestamp = Date.parse(value);

    return Number.isNaN(timestamp) ? null : timestamp;
}


function isReadyImageAttachment(attachment) {
    return attachment &&
        attachment.type === "image" &&
        attachment.processing === 0 &&
        attachment.is_allowed_for_media_url === true &&
        attachment.source;
}


function normalizeAttachment(attachment) {
    return {
        id: attachment.id,
        url: attachment.source,
        name: attachment.name,
        contentType: attachment.content_type,
        messageId: attachment.message_id,
        conversationId: attachment.conversation_id,
        createdAt: attachment.created_at
    };
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
 * Gets the best matching recently uploaded Salesmsg image attachment.
 *
 * Some Salesmsg attachment payloads do not include message_id, so we match
 * by message id when available, then fall back to conversation and recency.
 */
async function getRecentAttachment(messageId, options = {}) {

    const maxAttempts = options.maxAttempts || 5;
    const delayMs = options.delayMs || 3000;
    const conversationId = options.conversationId;
    const messageCreatedAt = parseTime(options.messageCreatedAt);
    const minCreatedAt = parseTime(options.minCreatedAt);
    const allowedBeforeMs = options.allowedBeforeMs || 15 * 1000;
    const allowedAfterMs = options.allowedAfterMs || 10 * 60 * 1000;
    const requireConversationMatch = options.requireConversationMatch !== false;
    const requireTimeMatch = options.requireTimeMatch !== false;
    const requireMinCreatedAt = Boolean(minCreatedAt);


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

            let validImages = attachments.filter(isReadyImageAttachment);

            if (validImages.length === 0) {
                console.log(`[Attempt ${attempt}/${maxAttempts}] No ready image attachments yet`);
                continue;
            }

            const exactMessageImage = validImages.find(a =>
                a.message_id &&
                String(a.message_id) === String(messageId)
            );

            if (exactMessageImage) {
                console.log(
                    `[Attempt ${attempt}/${maxAttempts}] Using image matched by message id:`,
                    exactMessageImage.name,
                    exactMessageImage.id
                );

                return normalizeAttachment(exactMessageImage);
            }

            if (conversationId) {
                const conversationImages = validImages.filter(a =>
                    a.conversation_id &&
                    String(a.conversation_id) === String(conversationId)
                );

                if (conversationImages.length > 0) {
                    validImages = conversationImages;
                } else if (requireConversationMatch) {
                    console.log(`[Attempt ${attempt}/${maxAttempts}] No image matched this conversation yet`);
                    continue;
                }
            }

            if (messageCreatedAt) {
                const nearbyImages = validImages.filter(a => {
                    const attachmentCreatedAt = parseTime(a.created_at);

                    return attachmentCreatedAt &&
                        attachmentCreatedAt >= messageCreatedAt - allowedBeforeMs &&
                        attachmentCreatedAt <= messageCreatedAt + allowedAfterMs;
                });

                if (nearbyImages.length > 0) {
                    validImages = nearbyImages;
                } else if (requireTimeMatch) {
                    console.log(`[Attempt ${attempt}/${maxAttempts}] No image matched this message time yet`);
                    continue;
                }
            }

            if (minCreatedAt) {
                const newImages = validImages.filter(a => {
                    const attachmentCreatedAt = parseTime(a.created_at);

                    return attachmentCreatedAt &&
                        attachmentCreatedAt >= minCreatedAt;
                });

                if (newImages.length > 0) {
                    validImages = newImages;
                } else if (requireMinCreatedAt) {
                    console.log(`[Attempt ${attempt}/${maxAttempts}] No new image created for this webhook yet`);
                    continue;
                }
            }

            const image = validImages[0];

            console.log(
                `[Attempt ${attempt}/${maxAttempts}] Using best matching ready image:`,
                image.name,
                image.id
            );

            return normalizeAttachment(image);


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

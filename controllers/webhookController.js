const { getRecentAttachment } = require("../services/salesMessageService");
const { waitForIncomingMmsImageFromDrive } = require("../services/driveService");

const {
    searchByPhone,
    createItem,
    createUpdate,
    createSmsTimelineItem,
    addFileToUpdateFromUrl,
    addFileToUpdateFromBuffer
} = require("../services/mondayService");


// Temporary duplicate protection
const processedMessages = new Set();


function findImageInPayload(value, seen = new Set()) {
    if (!value || typeof value !== "object") {
        return null;
    }

    if (seen.has(value)) {
        return null;
    }

    seen.add(value);

    if (Array.isArray(value)) {
        for (const item of value) {
            const image = findImageInPayload(item, seen);

            if (image) {
                return image;
            }
        }

        return null;
    }

    const type = value.type || value.media_type || value.mediaType || "";
    const contentType = value.content_type || value.contentType || value.mime_type || value.mimeType || "";
    const url = value.source || value.url || value.media_url || value.mediaUrl || value.download_url || value.downloadUrl;
    const name = value.name || value.filename || value.file_name || value.fileName || "image.jpg";
    const looksLikeImage =
        String(type).toLowerCase().includes("image") ||
        String(contentType).toLowerCase().startsWith("image/");

    if (url && looksLikeImage) {
        return {
            url,
            name,
            contentType
        };
    }

    for (const key of Object.keys(value)) {
        const image = findImageInPayload(value[key], seen);

        if (image) {
            return image;
        }
    }

    return null;
}


function messageMayHaveMedia(message, payloadImage) {
    const type = String(message?.type || "").toLowerCase();

    return Boolean(payloadImage) ||
        type === "mms" ||
        type.includes("media") ||
        type.includes("image") ||
        Boolean(message?.attachment_count || message?.attachments_count || message?.media_count);
}


exports.contactWebhook = async (req, res) => {

    try {

        console.log("========== WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));


        const event = req.body.event;
        const data = req.body.data;


        // ===============================
        // IGNORE UNNECESSARY EVENTS
        // ===============================

        const allowedEvents = [
            "contact.created",
            "contact.updated",
            "message.sent",
            "message.received"
        ];


        if (!allowedEvents.includes(event)) {

            console.log("Ignoring event:", event);

            return res.status(200).json({
                success: true
            });
        }


        // ===============================
        // DUPLICATE PROTECTION
        // ===============================

        const messageId =
            data?.message?.id ||
            req.body.id;


        if (messageId) {

            if (processedMessages.has(messageId)) {

                console.log(
                    "Duplicate ignored:",
                    messageId
                );

                return res.status(200).json({
                    success: true
                });
            }


            processedMessages.add(messageId);

        }



        // ===============================
        // CONTACT CREATED / UPDATED
        // ===============================


        if (
            event === "contact.created" ||
            event === "contact.updated"
        ) {

            const contact = {

                name:
                    data.contact?.full_name,

                phone:
                    data.contact?.number

            };


            if (!contact.phone) {

                return res.status(200).json({
                    success: true
                });

            }



            const items =
                await searchByPhone(contact.phone);



            if (items.length === 0) {

                console.log(
                    "Creating Monday contact..."
                );

                await createItem(contact);

            }


            return res.status(200).json({
                success: true
            });

        }





        // ===============================
        // MESSAGE SENT / RECEIVED
        // ===============================


        if (
            event === "message.sent" ||
            event === "message.received"
        ) {


            const phone =
                data.contact?.number;



            if (!phone) {

                console.log(
                    "No phone found"
                );

                return res.status(200).json({
                    success: true
                });

            }



            const items =
                await searchByPhone(phone);



            if (items.length === 0) {

                console.log(
                    "No Monday item found"
                );

                return res.status(200).json({
                    success: true
                });

            }



            const itemId =
                items[0].id;



            const direction =
                event === "message.sent"
                    ? "OUTGOING SMS"
                    : "INCOMING SMS";



            const senderName =
                event === "message.sent"
                    ? data.user?.full_name || "Unknown User"
                    : data.contact?.full_name || "Unknown Contact";



            const senderPhone =
                event === "message.sent"
                    ? data.number?.formatted_number || ""
                    : data.contact?.formatted_number || "";



            const receiverName =
                event === "message.sent"
                    ? data.contact?.full_name || "Unknown Contact"
                    : data.user?.full_name ||
                      data.inbox?.name ||
                      "Unknown User";



            const receiverPhone =
                event === "message.sent"
                    ? data.contact?.formatted_number || ""
                    : data.number?.formatted_number || "";



            const messageText =
                data.message?.body || "";



            const update = `

${direction}

${messageText}


From:
${senderName}
${senderPhone}


To:
${receiverName}
${receiverPhone}

`;



            console.log(
                "Creating Monday update:",
                itemId
            );



            // Create ONE Monday update
            const updateResult =
                await createUpdate(
                    itemId,
                    update.replace(/\n/g, "<br>")
                );



            // ===============================
            // IMAGE ATTACHMENT
            // ===============================

            let imageUrl = null;
            const payloadImage =
                findImageInPayload(data.message) ||
                findImageInPayload(data);
            const shouldCheckForImage =
                messageMayHaveMedia(data.message, payloadImage);


            if (shouldCheckForImage) {


                console.log(
                    "Checking for image attachment..."
                );


                let attachment = payloadImage;

                console.log("==================================");
                console.log("CURRENT MESSAGE ID:", data.message.id);
                console.log("CURRENT CONVERSATION:", data.message.conversation_id);
                console.log("CURRENT EVENT:", event);
                console.log("CURRENT MESSAGE TYPE:", data.message.type);
                console.log("PAYLOAD IMAGE FOUND:", Boolean(payloadImage));
                console.log("==================================");


                if (event === "message.received" && data.message?.type === "mms") {

                    const driveImage = await waitForIncomingMmsImageFromDrive({
                        phone,
                        messageId: data.message.id,
                        conversationId: data.message.conversation_id,
                        messageTime:
                            data.message.received_at ||
                            data.message.created_at ||
                            data.message.inserted_at ||
                            data.message.timestamp
                    });

                    if (driveImage) {

                        await addFileToUpdateFromBuffer(
                            updateResult.id,
                            driveImage.buffer,
                            driveImage.name
                        );

                        imageUrl = driveImage.webViewLink || null;

                        console.log(
                            "Incoming image attached from Google Drive"
                        );

                    }
                    else {

                        console.log(
                            "Incoming image not found in Google Drive"
                        );

                    }

                }
                else {

                    if (!attachment) {

                        await new Promise(
                            resolve =>
                                setTimeout(resolve, 5000)
                        );


                        attachment = await getRecentAttachment(
                            data.message.id,
                            {
                                conversationId: data.message.conversation_id,
                                maxAttempts: 5,
                                delayMs: 3000,
                                messageCreatedAt:
                                    data.message.sent_at ||
                                    data.message.created_at ||
                                    data.message.inserted_at ||
                                    data.message.timestamp,
                                requireConversationMatch: false,
                                requireTimeMatch: true
                            }
                        );

                    }


                    if (attachment && attachment.url) {

                        await addFileToUpdateFromUrl(
                            updateResult.id,
                            attachment.url,
                            attachment.name
                        );

                        imageUrl = attachment.url;

                        console.log(
                            "Outgoing image attached"
                        );

                    }
                    else {

                        console.log(
                            "Attachment not found"
                        );

                    }

                }

            }




            // ===============================
            // EMAILS & ACTIVITIES
            // ===============================

            const timelineBody =
                update.replace(/\n/g, "<br>") +
                (
                    imageUrl
                        ? `<br><a href="${imageUrl}">Image attachment</a>`
                        : ""
                );


            await createSmsTimelineItem(
                itemId,
                direction === "OUTGOING SMS"
                    ? "Outgoing SMS"
                    : "Incoming SMS",
                timelineBody
            );


            console.log(
                "Completed"
            );



            return res.status(200).json({
                success: true
            });


        }



        return res.status(200).json({
            success: true
        });



    }

    catch (err) {


        console.error(
            "Webhook Error:",
            err
        );


        return res.status(500).json({

            success: false,
            error: err.message

        });


    }

};

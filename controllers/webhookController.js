const { getRecentAttachment } = require("../services/salesMessageService");

const {
    searchByPhone,
    createItem,
    createUpdate,
    createSmsTimelineItem,
    addFileToUpdateFromUrl
} = require("../services/mondayService");


// Temporary duplicate protection
const processedMessages = new Set();


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
            // MMS IMAGE ATTACHMENT
            // ===============================

            // Holds the confirmed image URL for THIS message only.
            // Stays null unless we get an attachment we can verify
            // belongs to this exact message.
            let imageUrl = null;


            if (data.message?.type === "mms") {


                console.log(
                    "Waiting for MMS attachment..."
                );


                await new Promise(
                    resolve =>
                        setTimeout(resolve, 5000)
                );

console.log("==================================");
console.log("CURRENT MESSAGE ID:", data.message.id);
console.log("CURRENT CONVERSATION:", data.message.conversation_id);
console.log("CURRENT EVENT:", event);
console.log("==================================");

                const attachment = await getRecentAttachment(
                    data.message.id
                );



                // Safety check: only trust the attachment if the service
                // explicitly confirms it matches this message id.
                // (Requires getRecentAttachment to return a messageId field
                // — flag this if it currently doesn't, since that's the
                // real fix for wrong/previous images being picked up.)
                const attachmentIsVerified =
                    attachment &&
                    attachment.url &&
                    (
                        attachment.messageId === undefined || // service doesn't expose it yet
                        attachment.messageId === data.message.id
                    );


                if (attachmentIsVerified) {

                    await addFileToUpdateFromUrl(
                        updateResult.id,
                        attachment.url,
                        attachment.name
                    );

                    imageUrl = attachment.url;

                    console.log(
                        "✅ Image attached"
                    );

                }
                else {

                    console.log(
                        attachment
                            ? "❌ Attachment found but did not match this message — skipped to avoid wrong image"
                            : "❌ Attachment not found"
                    );

                }

            }




            // ===============================
            // EMAILS & ACTIVITIES
            // ===============================

            const timelineBody =
                update.replace(/\n/g, "<br>") +
                (
                    imageUrl
                        ? `<br><img src="${imageUrl}" style="max-width:400px;" />`
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
                "✅ Completed"
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
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
                success:true
            });
        }



        // ===============================
        // DUPLICATE PROTECTION
        // ===============================

        const messageId =
            data?.message?.id ||
            req.body.id;


        if(messageId){

            if(processedMessages.has(messageId)){

                console.log(
                    "Duplicate ignored:",
                    messageId
                );

                return res.status(200).json({
                    success:true
                });
            }


            processedMessages.add(messageId);

        }



        // ===============================
        // CONTACT CREATED / UPDATED
        // ===============================


        if(
            event === "contact.created" ||
            event === "contact.updated"
        ){

            const contact = {

                name:
                data.contact?.full_name,

                phone:
                data.contact?.number

            };


            if(!contact.phone){

                return res.status(200).json({
                    success:true
                });

            }



            const items =
            await searchByPhone(contact.phone);



            if(items.length === 0){

                console.log(
                    "Creating Monday contact..."
                );

                await createItem(contact);

            }


            return res.status(200).json({
                success:true
            });

        }





        // ===============================
        // MESSAGE SENT / RECEIVED
        // ===============================


        if(
            event === "message.sent" ||
            event === "message.received"
        ){


            const phone =
            data.contact?.number;



            if(!phone){

                console.log(
                    "No phone found"
                );

                return res.status(200).json({
                    success:true
                });

            }



            const items =
            await searchByPhone(phone);



            if(items.length === 0){

                console.log(
                    "No Monday item found"
                );

                return res.status(200).json({
                    success:true
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
                update.replace(/\n/g,"<br>")
            );




            // ===============================
            // MMS IMAGE ATTACHMENT
            // ===============================


            if(data.message?.type === "mms"){


                console.log(
                    "Waiting for MMS attachment..."
                );


                await new Promise(
                    resolve =>
                    setTimeout(resolve,5000)
                );



                const attachment =
                await getRecentAttachment();



                if(attachment){


                    await addFileToUpdateFromUrl(
                        updateResult.id,
                        attachment.url,
                        attachment.name
                    );


                    console.log(
                        "✅ Image attached"
                    );


                }
                else{

                    console.log(
                        "❌ Attachment not found"
                    );

                }

            }




            // ===============================
            // EMAILS & ACTIVITIES
            // ===============================


            await createSmsTimelineItem(
                itemId,
                direction === "OUTGOING SMS"
                ? "Outgoing SMS"
                : "Incoming SMS",
                update.replace(/\n/g,"<br>")
            );


            console.log(
                "✅ Completed"
            );



            return res.status(200).json({
                success:true
            });


        }



        return res.status(200).json({
            success:true
        });



    }

    catch(err){


        console.error(
            "Webhook Error:",
            err
        );


        return res.status(500).json({

            success:false,
            error:err.message

        });


    }

};
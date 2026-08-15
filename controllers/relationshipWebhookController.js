const {
    getItem,
    createTask,
    connectItems,
    updateColumnValues
} = require("../services/mondayService");

const TASK_BOARD_ID = process.env.TASK_BOARD_ID;
const TASK_CONNECT_COLUMN = process.env.TASK_CONNECT_COLUMN;

const RELATIONSHIP_LINK_COLUMN_ID = process.env.RELATIONSHIP_LINK_COLUMN_ID || "link_mm2w5y8t";
const RELATIONSHIP_STATUS_COLUMN_ID = process.env.RELATIONSHIP_STATUS_COLUMN_ID || "color_mm3hgyby";

exports.relationshipWebhook = async (req, res) => {

    try {

        console.log("========== RELATIONSHIP WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        // Monday verification challenge
        if (req.body.challenge) {
            return res.status(200).json({
                challenge: req.body.challenge
            });
        }

        const event = req.body.event;

        if (!event) {
            return res.status(200).json({
                success: true
            });
        }

        const parentItemId = event.parentItemId;

        // ===============================
        // TOP-LEVEL ITEM CREATED ON RELATIONSHIP BOARD
        // (no parentItemId means this is NOT a subitem)
        // ===============================
        if (!parentItemId) {

            const newItemId = event.pulseId;
            const boardId = event.boardId;

            console.log("New top-level Relationship item created:", newItemId);

            const item = await getItem(newItemId);

            if (!item) {
                console.log("Could not fetch new item, skipping.");
                return res.status(200).json({ success: true });
            }

            const linkColumn = item.column_values?.find(
                c => c.id === RELATIONSHIP_LINK_COLUMN_ID
            );

            const hasLinkValue = Boolean(
                linkColumn && linkColumn.text && linkColumn.text.trim() !== ""
            );

            console.log(
                `Link column (${RELATIONSHIP_LINK_COLUMN_ID}) value:`,
                linkColumn?.text,
                "-> hasLinkValue:",
                hasLinkValue
            );

            if (hasLinkValue) {

                await updateColumnValues(boardId, newItemId, {
                    [RELATIONSHIP_STATUS_COLUMN_ID]: { label: "Engage" }
                });

                console.log("✅ Status set to Engage on relationship item", newItemId);

            } else {

                console.log("No value in link column - leaving status unchanged.");

            }

            return res.status(200).json({
                success: true
            });

        }

        // ===============================
        // SUBITEM CREATED -> CREATE TASK (existing behavior, unchanged)
        // ===============================

        const subitemId = event.pulseId;

        console.log("Fetching subitem:", subitemId);

        const subitem = await getItem(subitemId);

        if (!subitem) {

            console.log("Subitem not found.");

            return res.status(200).json({
                success: true
            });

        }

        console.log("Subitem Name:", subitem.name);

        // Create task
        const task = await createTask(
            TASK_BOARD_ID,
            subitem.name
        );

        console.log("Task Created:", task);

        // Connect Task -> Parent Relationship Item
        await connectItems(
            TASK_BOARD_ID,
            task.id,
            TASK_CONNECT_COLUMN,
            parentItemId
        );

        console.log("✅ Task connected to Relationship item.");

        await connectItems(
            event.boardId,
            subitemId,
            process.env.SUBITEM_CONNECT_COLUMN,
            task.id
        );

        console.log("✅ Subitem connected to Task.");

        return res.status(200).json({
            success: true
        });

    } catch (err) {

        console.error("Relationship Webhook Error:");
        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

};
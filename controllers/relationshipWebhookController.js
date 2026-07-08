const {
    getItem,
    createTask,
    connectItems
} = require("../services/mondayService");

const TASK_BOARD_ID = process.env.TASK_BOARD_ID;
const TASK_CONNECT_COLUMN = process.env.TASK_CONNECT_COLUMN;
const SUBITEM_CONNECT_COLUMN = process.env.SUBITEM_CONNECT_COLUMN;

exports.relationshipWebhook = async (req, res) => {

    try {

        console.log("========== RELATIONSHIP WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        // Monday verification
        if (req.body.challenge) {
            return res.status(200).json({
                challenge: req.body.challenge
            });
        }

        const event = req.body.event;

        if (!event) {
            return res.status(200).json({ success: true });
        }

        const subitemId = event.pulseId;

        console.log("Fetching subitem:", subitemId);

        const subitem = await getItem(subitemId);

        if (!subitem) {
            console.log("Subitem not found.");
            return res.status(200).json({ success: true });
        }

        console.log("Subitem Name:", subitem.name);

        // Create task in Task Board
        const task = await createTask(
            TASK_BOARD_ID,
            subitem.name
        );

        console.log("Task Created:", task);

        // Connect Task -> Subitem
        await connectItems(
            TASK_BOARD_ID,
            task.id,
            TASK_CONNECT_COLUMN,
            subitemId
        );

        // Connect Subitem -> Task
        await connectItems(
            event.boardId,
            subitemId,
            SUBITEM_CONNECT_COLUMN,
            task.id
        );

        console.log("✅ Task and Subitem connected.");

        return res.status(200).json({
            success: true
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

};
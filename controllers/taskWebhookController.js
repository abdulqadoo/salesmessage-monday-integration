const TASK_BOARD_ID = process.env.TASK_BOARD_ID;
const { searchItemByName, connectItems } = require("../services/mondayService");

const RELATIONSHIP_BOARD_ID = process.env.RELATIONSHIP_BOARD_ID;
const CONNECT_COLUMN_ID = process.env.CONNECT_COLUMN_ID;

exports.taskWebhook = async (req, res) => {

    try {

        console.log("========== TASK WEBHOOK ==========");
        console.log(JSON.stringify(req.body, null, 2));

        if (req.body.challenge) {
            return res.status(200).json({ challenge: req.body.challenge });
        }

        const event = req.body.event;

        if (!event) {
            return res.status(200).json({ success: true });
        }

        const taskItemId = event.pulseId;
        const taskName = event.pulseName;

        if (!taskName) {
            console.log("No task name found, skipping.");
            return res.status(200).json({ success: true });
        }

        const matches = await searchItemByName(RELATIONSHIP_BOARD_ID, taskName);

        if (!matches || matches.length === 0) {
            console.log("No matching subitem found for:", taskName);
            return res.status(200).json({ success: true });
        }

        const subitemId = matches[0].id;

        await connectItems(
               RELATIONSHIP_BOARD_ID,
               taskItemId,
               CONNECT_COLUMN_ID,
               subitemId
);

        console.log(`✅ Connected task ${taskItemId} to subitem ${subitemId}`);

        return res.status(200).json({ success: true });

    } catch (err) {

        console.error("Task Webhook Error:");
        console.error(err);

        return res.status(500).json({
            success: false,
            error: err.message
        });

    }

};
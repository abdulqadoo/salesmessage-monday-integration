// Copy this next to your existing createTaskWebhook.js and run once:
// node registerMeetingWebhook.js

require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const MEETINGS_BOARD_ID = "18415945114";
const WEBHOOK_URL = "https://salesmessage-monday-integration-production.up.railway.app/monday-meeting-webhook";

async function registerWebhook() {

    const query = `
        mutation {
            create_webhook (
                board_id: ${MEETINGS_BOARD_ID},
                url: "${WEBHOOK_URL}",
                event: create_item
            ) {
                id
                board_id
            }
        }
    `;

    const response = await axios.post(
        "https://api.monday.com/v2",
        { query },
        {
            headers: {
                Authorization: MONDAY_TOKEN,
                "Content-Type": "application/json"
            }
        }
    );

    console.log(JSON.stringify(response.data, null, 2));

}

registerWebhook();
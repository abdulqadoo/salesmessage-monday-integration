require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID; // pulls from your .env
const WEBHOOK_URL = "https://salesmessage-monday-integration-production.up.railway.app/monday-meeting-webhook";

async function createWebhook() {

    const mutation = `
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

    try {
        const response = await axios.post(
            "https://api.monday.com/v2",
            { query: mutation },
            {
                headers: {
                    Authorization: MONDAY_TOKEN,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("====== MEETING WEBHOOK CREATED ======");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log("====== MEETING WEBHOOK ERROR ======");
        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }
    }
}

createWebhook();
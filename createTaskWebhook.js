require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const TASK_BOARD_ID = "18411510462"; // <-- change this
const WEBHOOK_URL = "https://salesmessage-monday-integration-production.up.railway.app/monday-task-webhook";

async function createWebhook() {

    const mutation = `
        mutation {
            create_webhook (
                board_id: ${TASK_BOARD_ID},
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

        console.log("====== WEBHOOK CREATED ======");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log("====== WEBHOOK ERROR ======");
        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }
    }
}

createWebhook();
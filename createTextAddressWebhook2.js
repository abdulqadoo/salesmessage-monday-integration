require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const ADDRESS_BOARD_ID = process.env.BOARD_ID;
const WEBHOOK_URL = "https://salesmessage-monday-integration-production.up.railway.app/text-address-webhook";

async function createWebhook() {

    const mutation = `
        mutation {
            create_webhook (
                board_id: ${ADDRESS_BOARD_ID},
                url: "${WEBHOOK_URL}",
                event: change_specific_column_value,
                config: "{\\"columnId\\":\\"text_mm5wmtxq\\"}"
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

        console.log("====== ADDRESS WEBHOOK CREATED ======");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log(error.response?.data || error.message);
    }
}

createWebhook();
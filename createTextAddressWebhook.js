require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const BOARD_ID = process.env.BOARD_ID;
const TEXT_ADDRESS_COLUMN_ID = process.env.TEXT_ADDRESS_COLUMN_ID || "text_mm5wmtxq";
const WEBHOOK_URL = "https://salesmessage-monday-integration-production.up.railway.app/text-address-webhook";

async function createWebhook() {

    const mutation = `
        mutation {
            create_webhook (
                board_id: ${BOARD_ID},
                url: "${WEBHOOK_URL}",
                event: change_specific_column_value,
                config: "{\\"columnId\\":\\"${TEXT_ADDRESS_COLUMN_ID}\\"}"
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
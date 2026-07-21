require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const MEETINGS_BOARD_ID = process.env.MEETINGS_BOARD_ID;

async function listWebhooks() {

    const query = `
        query {
            webhooks (board_id: ${MEETINGS_BOARD_ID}) {
                id
                event
                board_id
            }
        }
    `;

    try {
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

        console.log("====== WEBHOOKS ON THIS BOARD ======");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.log(error.response?.data || error.message);
    }
}

listWebhooks();
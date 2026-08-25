require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const WEBHOOK_IDS = ["617874900", "780097569"];

async function deleteWebhooks() {

    for (const id of WEBHOOK_IDS) {

        const mutation = `
            mutation {
                delete_webhook(webhook_id: ${id}) {
                    id
                }
            }
        `;

        try {
            const response = await axios.post(
                "https://api.monday.com/v2",
                { query: mutation },
                { headers: { Authorization: MONDAY_TOKEN, "Content-Type": "application/json" } }
            );
            console.log(`Deleted ${id}:`, JSON.stringify(response.data));
        } catch (error) {
            console.log(`Error deleting ${id}:`, error.response?.data || error.message);
        }

    }

}

deleteWebhooks();
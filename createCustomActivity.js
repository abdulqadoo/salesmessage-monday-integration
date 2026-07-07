require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;

async function createCustomActivity() {

    const mutation = `
        mutation {
            create_timeline_item_custom_activity(
                icon_id: chat,
                icon_color: "#0086c0",
                name: "SMS Message"
            ) {
                id
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

        console.log("====== CUSTOM ACTIVITY RESPONSE ======");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {

        console.log("====== CUSTOM ACTIVITY ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

    }

}

createCustomActivity();
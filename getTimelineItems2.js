require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const ITEM_ID = "11912105359";

async function getTimelineItems() {

    const query = `
        query {
            timeline_item (item_id: [${ITEM_ID}]) {
                id
                title
                custom_activity_id
                content
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

        console.log("====== TIMELINE ITEMS ======");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {

        console.log("====== ERROR ======");

        if (error.response) {
            console.log(JSON.stringify(error.response.data, null, 2));
        } else {
            console.log(error.message);
        }

    }

}

getTimelineItems();
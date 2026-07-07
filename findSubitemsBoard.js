require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const RELATIONSHIP_BOARD_ID = process.env.RELATIONSHIP_BOARD_ID;

async function findSubitemsBoard() {

    const query = `
        query {
            boards (ids: ${RELATIONSHIP_BOARD_ID}) {
                columns {
                    id
                    title
                    type
                    settings_str
                }
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

        console.log("====== BOARD COLUMNS ======");
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

findSubitemsBoard();
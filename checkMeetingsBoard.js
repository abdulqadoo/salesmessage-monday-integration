require("dotenv").config();
const axios = require("axios");

const MONDAY_TOKEN = process.env.MONDAY_TOKEN;
const MEETINGS_BOARD_ID = "18415945114";

async function checkBoard() {

    const query = `
        query {
            boards (ids: [${MEETINGS_BOARD_ID}]) {
                id
                name
                workspace_id
                state
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

        console.log("====== BOARD CHECK ======");
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

checkBoard();
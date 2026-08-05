require("dotenv").config();
const monday = require("./config/monday");

async function listColumns() {
    const query = `
        query {
            boards(ids: ${process.env.BOARD_ID}) {
                columns {
                    id
                    title
                    type
                }
            }
        }
    `;

    const response = await monday.post("", { query });
    console.log(JSON.stringify(response.data, null, 2));
}

listColumns();